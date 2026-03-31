/**
 * 指令解析器 — 通用版（去掉业务特定指令）
 *
 * 支持的指令:
 *   #用量          — 查看 token 使用统计
 *   #帮助          — 显示帮助
 *   #订阅 <插件名> — 订阅插件推送
 *   #退订 <插件名> — 退订插件推送
 *   #清除          — 清除对话上下文
 *   其他 # 开头     — 可能是插件触发
 *   其它任何消息    — 自然对话
 */

export type Command =
  | { readonly type: "usage" }
  | { readonly type: "help" }
  | { readonly type: "clear" }
  | { readonly type: "subscribe"; readonly pluginName: string }
  | { readonly type: "unsubscribe"; readonly pluginName: string }
  | { readonly type: "plugin"; readonly text: string }
  | { readonly type: "chat"; readonly text: string };

const BUILTIN_PREFIXES = ["#用量", "#帮助", "#help", "#订阅", "#退订", "#清除", "#clear"];

function looksLikePluginTrigger(text: string): boolean {
  if (!text.startsWith("#")) return false;
  return !BUILTIN_PREFIXES.some((p) => text.startsWith(p));
}

export function parseCommand(text: string): Command {
  const trimmed = text.trim();

  if (trimmed === "#用量") {
    return { type: "usage" };
  }

  if (trimmed === "#帮助" || trimmed === "#help") {
    return { type: "help" };
  }

  if (trimmed === "#清除" || trimmed === "#clear") {
    return { type: "clear" };
  }

  if (trimmed.startsWith("#订阅")) {
    const pluginName = trimmed.replace(/^#订阅\s*/, "").trim();
    if (pluginName) return { type: "subscribe", pluginName };
    return { type: "chat", text: trimmed };
  }

  if (trimmed.startsWith("#退订")) {
    const pluginName = trimmed.replace(/^#退订\s*/, "").trim();
    if (pluginName) return { type: "unsubscribe", pluginName };
    return { type: "chat", text: trimmed };
  }

  if (looksLikePluginTrigger(trimmed)) {
    return { type: "plugin", text: trimmed };
  }

  return { type: "chat", text: trimmed };
}
