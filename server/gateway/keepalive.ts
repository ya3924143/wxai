/**
 * Keepalive 服务 — 定期对每个账号执行 getupdates 保持连接
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { SYNC_BUFS_DIR } from "../config.js";
import { getAllAccounts, updateAccountStatus } from "../store/account-store.js";
import { setContextToken } from "../store/context-store.js";
import { getUpdates } from "./ilink-client.js";
import type { WxaiConfig } from "../types.js";

function syncBufPath(accountToken: string): string {
  const prefix = accountToken.slice(0, 16).replace(/[^a-zA-Z0-9]/g, "_");
  return resolve(SYNC_BUFS_DIR, `${prefix}.txt`);
}

function loadSyncBuf(accountToken: string): string {
  const path = syncBufPath(accountToken);
  if (!existsSync(path)) return "";
  try {
    return readFileSync(path, "utf-8").trim();
  } catch {
    return "";
  }
}

function saveSyncBuf(accountToken: string, buf: string): void {
  writeFileSync(syncBufPath(accountToken), buf);
}

const failCounts = new Map<string, number>();

async function keepAliveOnce(
  accountToken: string,
  baseUrl: string,
  maxFailures: number,
): Promise<void> {
  const syncBuf = loadSyncBuf(accountToken);

  try {
    const result = await getUpdates(baseUrl, accountToken, syncBuf, 10_000);

    if (result.syncBuf) {
      saveSyncBuf(accountToken, result.syncBuf);
    }

    for (const msg of result.msgs) {
      if (msg.from_user_id && msg.context_token) {
        setContextToken(accountToken, msg.from_user_id, msg.context_token);
      }
    }

    failCounts.set(accountToken, 0);
    updateAccountStatus(accountToken, "online", new Date().toISOString());
  } catch (err: unknown) {
    const count = (failCounts.get(accountToken) ?? 0) + 1;
    failCounts.set(accountToken, count);

    const errMsg = err instanceof Error ? err.message : "unknown";
    process.stderr.write(
      `[keepalive] ${accountToken.slice(0, 12)}... 失败 (${count}次): ${errMsg}\n`,
    );

    if (count >= maxFailures) {
      process.stderr.write(
        `[keepalive] ${accountToken.slice(0, 12)}... 连续失败 ${count} 次，标记为 offline\n`,
      );
      updateAccountStatus(accountToken, "offline");
    }
  }
}

export function startKeepAlive(config: WxaiConfig): () => void {
  const accountTimers: NodeJS.Timeout[] = [];
  let rescanTimer: NodeJS.Timeout | null = null;
  let stopped = false;

  function scheduleAll(): void {
    if (stopped) return;

    for (const t of accountTimers) clearInterval(t);
    accountTimers.length = 0;

    const accounts = getAllAccounts().filter(
      (a) => a.status !== "expired" && !a.keepaliveExclude,
    );

    for (const account of accounts) {
      keepAliveOnce(account.token, account.baseUrl, config.keepAliveMaxFailures).catch(() => {});

      const jitter = Math.floor(Math.random() * 10_000);
      const timer = setInterval(
        () => keepAliveOnce(account.token, account.baseUrl, config.keepAliveMaxFailures).catch(() => {}),
        config.keepAliveIntervalMs + jitter,
      );
      accountTimers.push(timer);
    }

    process.stderr.write(`[keepalive] 启动 ${accounts.length} 个账号的保活循环\n`);
  }

  scheduleAll();
  rescanTimer = setInterval(scheduleAll, 30 * 60 * 1000);

  return () => {
    stopped = true;
    for (const t of accountTimers) clearInterval(t);
    if (rescanTimer !== null) clearInterval(rescanTimer);
  };
}
