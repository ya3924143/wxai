/**
 * Echo 插件 — 示例插件，回声测试
 *
 * 触发词: #echo
 * 功能: 将用户输入原样返回
 */

import type { WxaiPlugin, PluginContext, PluginResult } from "../types.js";

export const echoPlugin: WxaiPlugin = {
  id: "echo",
  name: "回声测试",
  description: "将你的消息原样返回（用于测试插件系统）",
  triggers: ["#echo", "#回声"],

  async execute(ctx: PluginContext): Promise<PluginResult> {
    const text = ctx.args.trim() || "（空消息）";
    await ctx.reply(`🔊 ${text}`);
    return { handled: true };
  },
};
