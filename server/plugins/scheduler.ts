/**
 * 插件定时调度 — 使用 node-cron
 */

import cron from "node-cron";
import type { WxaiPlugin, PluginContext } from "./types.js";
import type { AiProvider } from "../ai/types.js";
import type { WxaiConfig } from "../types.js";

interface ScheduledTask {
  readonly pluginId: string;
  readonly task: cron.ScheduledTask;
}

const scheduledTasks: ScheduledTask[] = [];

export function startScheduler(
  plugins: readonly WxaiPlugin[],
  createContext: (pluginId: string) => PluginContext,
): void {
  // 清理旧的定时任务
  for (const task of scheduledTasks) {
    task.task.stop();
  }
  scheduledTasks.length = 0;

  for (const plugin of plugins) {
    if (!plugin.schedule) continue;

    if (!cron.validate(plugin.schedule.cron)) {
      process.stderr.write(
        `[scheduler] 无效的 cron 表达式: ${plugin.schedule.cron} (${plugin.id})\n`,
      );
      continue;
    }

    const task = cron.schedule(plugin.schedule.cron, async () => {
      process.stderr.write(
        `[scheduler] 触发定时任务: ${plugin.name} (${plugin.schedule!.label})\n`,
      );

      try {
        const ctx = createContext(plugin.id);
        await plugin.execute(ctx);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[scheduler] ${plugin.id} 执行失败: ${msg}\n`);
      }
    });

    scheduledTasks.push({ pluginId: plugin.id, task });
    process.stderr.write(
      `[scheduler] 注册定时任务: ${plugin.name} — ${plugin.schedule.cron} (${plugin.schedule.label})\n`,
    );
  }
}

export function stopScheduler(): void {
  for (const task of scheduledTasks) {
    task.task.stop();
  }
  scheduledTasks.length = 0;
}
