/**
 * 插件注册、匹配、执行
 */

import type { WxaiPlugin, PluginContext, PluginResult } from "./types.js";

const plugins: WxaiPlugin[] = [];

export function registerPlugin(plugin: WxaiPlugin): void {
  const existing = plugins.findIndex((p) => p.id === plugin.id);
  if (existing >= 0) {
    plugins[existing] = plugin;
  } else {
    plugins.push(plugin);
  }
  process.stderr.write(`[plugins] 注册插件: ${plugin.name} (${plugin.id})\n`);
}

export function matchPlugin(text: string): WxaiPlugin | undefined {
  const trimmed = text.trim().toLowerCase();
  return plugins.find((p) =>
    p.triggers.some((t) => trimmed.startsWith(t.toLowerCase())),
  );
}

export async function executePlugin(
  plugin: WxaiPlugin,
  ctx: PluginContext,
): Promise<PluginResult> {
  try {
    return await plugin.execute(ctx);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[plugins] 执行 ${plugin.id} 失败: ${msg}\n`);
    return { handled: false, error: msg };
  }
}

export function getRegisteredPlugins(): readonly WxaiPlugin[] {
  return [...plugins];
}
