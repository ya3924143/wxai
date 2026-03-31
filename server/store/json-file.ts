/**
 * 通用 JSON 文件读写工具 — 不可变更新
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { ensureDataDir } from "../config.js";

export function readJsonFile<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFile<T>(path: string, data: T): void {
  ensureDataDir();
  writeFileSync(path, JSON.stringify(data, null, 2));
}
