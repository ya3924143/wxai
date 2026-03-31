/**
 * 用量追踪 — JSON 文件持久化（替代 SQLite）
 */

import { resolve } from "node:path";
import { DATA_DIR } from "../config.js";
import { readJsonFile, writeJsonFile } from "../store/json-file.js";

const USAGE_PATH = resolve(DATA_DIR, "usage.json");

interface UsageEntry {
  readonly userId: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
  readonly model: string;
  readonly timestamp: string;
}

interface UsageData {
  readonly entries: readonly UsageEntry[];
}

function readUsage(): UsageData {
  return readJsonFile<UsageData>(USAGE_PATH, { entries: [] });
}

export function recordUsage(entry: UsageEntry): void {
  const data = readUsage();
  const updated: UsageData = {
    entries: [...data.entries, entry],
  };
  writeJsonFile(USAGE_PATH, updated);
}

export function getUserUsage(userId: string): {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  callCount: number;
} {
  const data = readUsage();
  const userEntries = data.entries.filter((e) => e.userId === userId);

  return {
    totalInputTokens: userEntries.reduce((sum, e) => sum + e.inputTokens, 0),
    totalOutputTokens: userEntries.reduce((sum, e) => sum + e.outputTokens, 0),
    totalCostUsd: userEntries.reduce((sum, e) => sum + e.costUsd, 0),
    callCount: userEntries.length,
  };
}

export function getTotalUsage(): {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  callCount: number;
} {
  const data = readUsage();
  return {
    totalInputTokens: data.entries.reduce((sum, e) => sum + e.inputTokens, 0),
    totalOutputTokens: data.entries.reduce((sum, e) => sum + e.outputTokens, 0),
    totalCostUsd: data.entries.reduce((sum, e) => sum + e.costUsd, 0),
    callCount: data.entries.length,
  };
}

export function formatUsage(userId: string): string {
  const u = getUserUsage(userId);
  if (u.callCount === 0) return "暂无使用记录";

  const totalTokens = u.totalInputTokens + u.totalOutputTokens;
  return [
    `调用次数: ${u.callCount}`,
    `总 token: ${totalTokens.toLocaleString()}`,
    `  输入: ${u.totalInputTokens.toLocaleString()}`,
    `  输出: ${u.totalOutputTokens.toLocaleString()}`,
    `累计费用: $${u.totalCostUsd.toFixed(4)}`,
  ].join("\n");
}
