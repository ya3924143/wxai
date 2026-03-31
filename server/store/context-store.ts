/**
 * context_token 存储 — 按账号分文件 + global 兜底
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { CONTEXT_TOKENS_DIR, ensureDataDir } from "../config.js";
import type { ContextTokenMap } from "../types.js";

function tokenPrefix(accountToken: string): string {
  return accountToken.slice(0, 16).replace(/[^a-zA-Z0-9]/g, "_");
}

function filePath(accountToken: string): string {
  return resolve(CONTEXT_TOKENS_DIR, `${tokenPrefix(accountToken)}.json`);
}

function readTokens(accountToken: string): ContextTokenMap {
  const path = filePath(accountToken);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as ContextTokenMap;
  } catch {
    return {};
  }
}

function writeTokens(accountToken: string, tokens: ContextTokenMap): void {
  ensureDataDir();
  writeFileSync(filePath(accountToken), JSON.stringify(tokens, null, 2));
}

export function getContextToken(
  accountToken: string,
  userId: string,
): string | undefined {
  return readTokens(accountToken)[userId];
}

export function setContextToken(
  accountToken: string,
  userId: string,
  contextToken: string,
): void {
  const tokens = readTokens(accountToken);
  writeTokens(accountToken, { ...tokens, [userId]: contextToken });
}

export function getAllContextTokens(
  accountToken: string,
): ContextTokenMap {
  return readTokens(accountToken);
}

/**
 * 查找某个 userId 的 context_token
 * 优先级：指定账号 → 其他账号文件 → global
 */
export function findContextToken(
  accountToken: string,
  userId: string,
): string | undefined {
  // 1. 指定账号下查找
  const specific = getContextToken(accountToken, userId);
  if (specific) return specific;

  // 2. 遍历所有账号的 context-token 文件
  try {
    const files = readdirSync(CONTEXT_TOKENS_DIR).filter(
      (f) => f.endsWith(".json") && f !== "global.json",
    );
    for (const file of files) {
      try {
        const tokens = JSON.parse(
          readFileSync(resolve(CONTEXT_TOKENS_DIR, file), "utf-8"),
        ) as ContextTokenMap;
        if (tokens[userId]) return tokens[userId];
      } catch {
        // skip corrupted files
      }
    }
  } catch {
    // CONTEXT_TOKENS_DIR may not exist
  }

  // 3. fallback: global
  const globalPath = resolve(CONTEXT_TOKENS_DIR, "global.json");
  if (!existsSync(globalPath)) return undefined;
  try {
    const global = JSON.parse(
      readFileSync(globalPath, "utf-8"),
    ) as ContextTokenMap;
    return global[userId];
  } catch {
    return undefined;
  }
}
