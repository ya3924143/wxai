/**
 * wxai — 配置加载与路径常量
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import type { WxaiConfig } from "./types.js";

export const DATA_DIR = resolve(homedir(), ".wxai");
export const ACCOUNTS_PATH = resolve(DATA_DIR, "accounts.json");
export const CONTEXT_TOKENS_DIR = resolve(DATA_DIR, "context-tokens");
export const SYNC_BUFS_DIR = resolve(DATA_DIR, "sync-bufs");
export const CONFIG_PATH = resolve(DATA_DIR, "config.json");
export const USERS_PATH = resolve(DATA_DIR, "users.json");

const DEFAULT_CONFIG: WxaiConfig = {
  port: 3800,
  host: "127.0.0.1",
  keepAliveIntervalMs: 5 * 60 * 1000,
  keepAliveMaxFailures: 5,
};

export function ensureDataDir(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(CONTEXT_TOKENS_DIR, { recursive: true });
  mkdirSync(SYNC_BUFS_DIR, { recursive: true });
}

export function loadConfig(): WxaiConfig {
  ensureDataDir();

  // 环境变量优先
  const envPort = process.env["WXAI_PORT"];
  const envHost = process.env["WXAI_HOST"];

  if (!existsSync(CONFIG_PATH)) {
    writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
  }

  let fileConfig: Partial<WxaiConfig> = {};
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    fileConfig = JSON.parse(raw) as Partial<WxaiConfig>;
  } catch {
    // ignore
  }

  return {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...(envPort ? { port: parseInt(envPort, 10) } : {}),
    ...(envHost ? { host: envHost } : {}),
  };
}
