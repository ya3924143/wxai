/**
 * 消息处理主逻辑 — 指令分发 + AI 对话
 *
 * 从 poller 直接调用（无 HTTP webhook），处理每批防抖合并的消息。
 */

import type { ParsedMessage, WxaiConfig } from "../types.js";
import type { AiProvider } from "../ai/types.js";
import { parseCommand } from "./command-parser.js";
import { routeChat } from "./chat-router.js";
import { HELP_TEXT } from "./help.js";
import { formatUsage, recordUsage } from "../ai/usage-tracker.js";
import { getAllAccounts } from "../store/account-store.js";
import { findContextToken } from "../store/context-store.js";
import { sendWechatMessage } from "../gateway/ilink-client.js";
import { canChat } from "../store/user-store.js";
import { matchPlugin, executePlugin } from "../plugins/loader.js";
import { subscribe, unsubscribe, isSubscribed } from "../store/user-store.js";

/** 创建消息处理器 */
export function createMessageHandler(ai: AiProvider, config?: WxaiConfig) {
  /** 回复消息给用户 */
  async function reply(
    userId: string,
    text: string,
    accountToken: string,
  ): Promise<void> {
    const accounts = getAllAccounts().filter((a) => a.status === "online");
    const account = accounts.find((a) => a.token === accountToken) ?? accounts[0];

    if (!account) {
      process.stderr.write(`[handler] 无可用账号回复 ${userId.slice(0, 12)}\n`);
      return;
    }

    const contextToken = findContextToken(account.token, userId);
    if (!contextToken) {
      process.stderr.write(`[handler] 无 contextToken: ${userId.slice(0, 12)}\n`);
      return;
    }

    // 微信单条消息限制约 2000 字，超长分段发送
    const chunks = splitMessage(text, 1800);
    for (const chunk of chunks) {
      const result = await sendWechatMessage(
        account.baseUrl,
        account.token,
        userId,
        chunk,
        contextToken,
      );
      if (!result.success) {
        process.stderr.write(
          `[handler] 发送失败 [${userId.slice(0, 12)}]: ${result.error}\n`,
        );
        break;
      }
    }
  }

  /** 处理一批合并后的消息 */
  async function handleMessages(
    messages: readonly ParsedMessage[],
  ): Promise<void> {
    if (messages.length === 0) return;

    // 取最后一条消息的发送者信息（防抖合并的都是同一用户）
    const last = messages[messages.length - 1]!;
    const userId = last.senderId;
    const accountToken = last.accountToken;

    // 合并所有文本
    const combinedText = messages.map((m) => m.text).join("\n");
    const imageBase64 = messages.find((m) => m.imageBase64)?.imageBase64;

    // 只处理文本和图片
    if (!combinedText.trim() && !imageBase64) return;

    // 权限检查（帮助指令不受限）
    const isHelp = combinedText.trim() === "#帮助" || combinedText.trim() === "#help";
    if (!isHelp && !canChat(userId)) {
      await reply(userId, "你还没有使用权限，请联系管理员开通。", accountToken);
      return;
    }

    try {
      await processMessage(userId, combinedText, accountToken, imageBase64);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[handler] 处理消息异常 [${userId.slice(0, 12)}]: ${errMsg}\n`);
      await reply(userId, "抱歉，处理消息时出错了，请稍后再试。", accountToken).catch(() => {});
    }
  }

  /** 处理单条消息 */
  async function processMessage(
    userId: string,
    text: string,
    accountToken: string,
    imageBase64?: string,
  ): Promise<void> {
    const command = parseCommand(text);

    switch (command.type) {
      case "help":
        await reply(userId, HELP_TEXT, accountToken);
        return;

      case "usage":
        await reply(userId, formatUsage(userId), accountToken);
        return;

      case "clear":
        await ai.clearSession(userId);
        await reply(userId, "对话上下文已清除，重新开始吧！", accountToken);
        return;

      case "subscribe":
        subscribe(userId, command.pluginName);
        await reply(userId, `已订阅: ${command.pluginName}`, accountToken);
        return;

      case "unsubscribe":
        unsubscribe(userId, command.pluginName);
        await reply(userId, `已退订: ${command.pluginName}`, accountToken);
        return;

      case "plugin": {
        const plugin = matchPlugin(command.text);
        if (!plugin) {
          await reply(userId, `未找到匹配的插件指令。发 #帮助 查看可用指令。`, accountToken);
          return;
        }

        // 提取触发词后的参数
        const trigger = plugin.triggers.find((t) =>
          command.text.toLowerCase().startsWith(t.toLowerCase()),
        );
        const args = trigger
          ? command.text.slice(trigger.length).trim()
          : command.text;

        await executePlugin(plugin, {
          userId,
          rawText: command.text,
          args,
          reply: (msg: string) => reply(userId, msg, accountToken),
          ai,
          config: config ?? { port: 3800, host: "127.0.0.1", keepAliveIntervalMs: 300000, keepAliveMaxFailures: 5 },
        });
        return;
      }

      case "chat": {
        const route = routeChat(command.text);

        const response = await ai.sessionSend(userId, command.text, {
          modelTier: route.modelTier,
          maxTurns: route.maxTurns,
          ...(imageBase64
            ? { images: [{ data: imageBase64, mediaType: "image/jpeg" }] }
            : {}),
        });

        // 记录用量
        recordUsage({
          userId,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          costUsd: response.costUsd,
          model: response.model,
          timestamp: new Date().toISOString(),
        });

        if (response.isError) {
          await reply(userId, `AI 处理出错: ${response.text}`, accountToken);
        } else {
          await reply(userId, response.text, accountToken);
        }
        return;
      }
    }
  }

  return handleMessages;
}

/** 分段发送长消息 */
function splitMessage(text: string, maxLen: number): readonly string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    // 优先在换行符处分割
    let splitIdx = remaining.lastIndexOf("\n", maxLen);
    if (splitIdx < maxLen * 0.5) {
      // 没有合适的换行符，在空格处分割
      splitIdx = remaining.lastIndexOf(" ", maxLen);
    }
    if (splitIdx < maxLen * 0.3) {
      // 强制截断
      splitIdx = maxLen;
    }

    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).trimStart();
  }

  return chunks;
}
