/**
 * 插件系统类型定义
 */

import type { AiProvider } from "../ai/types.js";
import type { WxaiConfig } from "../types.js";

/** 插件上下文 */
export interface PluginContext {
  readonly userId: string;
  readonly rawText: string;
  readonly args: string;
  readonly reply: (msg: string) => Promise<void>;
  readonly ai: AiProvider;
  readonly config: WxaiConfig;
}

/** 插件执行结果 */
export interface PluginResult {
  readonly handled: boolean;
  readonly error?: string;
}

/** 定时触发配置 */
export interface ScheduleConfig {
  readonly cron: string;
  readonly label: string;
}

/** 插件接口 */
export interface WxaiPlugin {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly triggers: readonly string[];
  readonly schedule?: ScheduleConfig;
  execute(ctx: PluginContext): Promise<PluginResult>;
}
