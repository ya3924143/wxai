/**
 * 消息解析 — 将 iLink 原始消息解析为 ParsedMessage
 *
 * 消息类型：1=text, 2=image, 3=voice, 4=file, 5=video
 */

import crypto from "node:crypto";
import type { ILinkMessage } from "./ilink-client.js";
import type { ParsedMessage } from "../types.js";

/**
 * 下载并解密 iLink CDN 图片
 * AES-CBC，IV 为密文前 16 字节
 */
async function downloadAndDecryptImage(
  cdnUrl: string,
  aesKeyBase64: string,
  accountToken: string,
): Promise<string | undefined> {
  try {
    // 域名白名单校验，防止 token 泄露到非预期服务器
    const CDN_ALLOWED_HOSTS = ["ilinkai.weixin.qq.com", "res.wx.qq.com"];
    const cdnHost = new URL(cdnUrl).hostname;
    if (!CDN_ALLOWED_HOSTS.includes(cdnHost)) {
      process.stderr.write(`[message-parser] 拒绝非白名单 CDN: ${cdnHost}\n`);
      return undefined;
    }

    const res = await fetch(cdnUrl, {
      headers: { Authorization: `Bearer ${accountToken}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      process.stderr.write(
        `[message-parser] 图片下载失败: ${res.status} ${cdnUrl}\n`,
      );
      return undefined;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const keyBuf = Buffer.from(aesKeyBase64, "base64");

    if (buf.length < 16) {
      process.stderr.write(`[message-parser] 图片数据过短: ${buf.length} bytes\n`);
      return undefined;
    }

    const iv = buf.subarray(0, 16);
    const ciphertext = buf.subarray(16);
    const algorithm = keyBuf.length === 16 ? "aes-128-cbc" : "aes-256-cbc";
    const decipher = crypto.createDecipheriv(algorithm, keyBuf, iv);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("base64");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[message-parser] 图片解密失败: ${msg}\n`);
    return undefined;
  }
}

/**
 * 将单条 iLink 原始消息解析为 ParsedMessage
 * 返回 undefined 表示该消息应被忽略
 */
export async function parseILinkMessage(
  msg: ILinkMessage,
  accountToken: string,
  accountId: string,
): Promise<ParsedMessage | undefined> {
  if (msg.message_type !== 1) return undefined;

  const senderId = msg.from_user_id ?? "";
  if (!senderId) return undefined;

  const contextToken = msg.context_token ?? "";
  if (!contextToken) return undefined;

  let text = "";
  let messageType: ParsedMessage["messageType"] = "text";
  let imageBase64: string | undefined;

  for (const item of msg.item_list ?? []) {
    switch (item.type) {
      case 1:
        text = item.text_item?.text ?? "";
        messageType = "text";
        break;

      case 3:
        text = item.voice_item?.text || "[语音]";
        messageType = "audio";
        break;

      case 2: {
        const img = item.image_item;
        if (img?.cdn_url && img.aes_key) {
          imageBase64 = await downloadAndDecryptImage(
            img.cdn_url,
            img.aes_key,
            accountToken,
          );
        }
        text = "[图片]";
        messageType = "image";
        break;
      }

      case 4:
        text = "[文件]";
        messageType = "file";
        break;

      case 5:
        text = "[视频]";
        messageType = "video";
        break;

      default:
        break;
    }
  }

  if (!text.trim()) return undefined;

  const chatId = msg.group_id || senderId;
  const chatType: ParsedMessage["chatType"] = msg.group_id ? "group" : "p2p";
  const messageId = msg.client_id ?? String(msg.create_time_ms ?? Date.now());
  const timestamp = msg.create_time_ms ?? Date.now();

  return {
    messageId,
    senderId,
    chatId,
    chatType,
    text,
    messageType,
    contextToken,
    timestamp,
    accountToken,
    accountId,
    ...(imageBase64 !== undefined ? { imageBase64 } : {}),
  };
}
