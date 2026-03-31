/**
 * Central Poller — 集中式消息轮询 & 直接分发
 *
 * 职责：
 *   1. 对每个在线账号长轮询 getupdates（40s timeout）
 *   2. 更新 context_token 缓存
 *   3. 3 秒防抖：快速连续消息合并后一次投递
 *   4. 直接调用 onMessage handler（不走 HTTP webhook）
 *   5. 每 60 秒重新扫描账号列表
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { SYNC_BUFS_DIR } from "../config.js";
import { getAllAccounts, updateAccountStatus } from "../store/account-store.js";
import { setContextToken } from "../store/context-store.js";
import { getUpdates } from "./ilink-client.js";
import { parseILinkMessage } from "./message-parser.js";
import type { ParsedMessage } from "../types.js";

/** 消息处理回调类型 */
export type MessageHandler = (messages: readonly ParsedMessage[]) => void;

// ── 游标持久化 ────────────────────────────────────────────────────────────────

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

// ── 防抖缓冲 ──────────────────────────────────────────────────────────────────

interface DebounceEntry {
  readonly messages: ParsedMessage[];
  timer: NodeJS.Timeout;
}

const debounceMap = new Map<string, DebounceEntry>();
const DEBOUNCE_MS = 3_000;

function scheduleDelivery(
  userId: string,
  message: ParsedMessage,
  onMessage: MessageHandler,
): void {
  const existing = debounceMap.get(userId);

  if (existing) {
    clearTimeout(existing.timer);
    existing.messages.push(message);
    existing.timer = setTimeout(
      () => flushDelivery(userId, existing, onMessage),
      DEBOUNCE_MS,
    );
  } else {
    const entry: DebounceEntry = {
      messages: [message],
      timer: setTimeout(() => {
        const e = debounceMap.get(userId);
        if (e) flushDelivery(userId, e, onMessage);
      }, DEBOUNCE_MS),
    };
    debounceMap.set(userId, entry);
  }
}

function flushDelivery(
  userId: string,
  entry: DebounceEntry,
  onMessage: MessageHandler,
): void {
  debounceMap.delete(userId);

  try {
    onMessage([...entry.messages]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[poller] onMessage 异常 [${userId.slice(0, 12)}]: ${msg}\n`);
  }
}

// ── 单账号轮询循环 ────────────────────────────────────────────────────────────

async function pollAccount(
  accountToken: string,
  accountId: string,
  baseUrl: string,
  signal: AbortSignal,
  onMessage: MessageHandler,
): Promise<void> {
  let failCount = 0;

  while (!signal.aborted) {
    try {
      const syncBuf = loadSyncBuf(accountToken);
      const result = await getUpdates(baseUrl, accountToken, syncBuf, 40_000);

      if (result.syncBuf) {
        saveSyncBuf(accountToken, result.syncBuf);
      }

      failCount = 0;
      updateAccountStatus(accountToken, "online", new Date().toISOString());

      for (const msg of result.msgs) {
        if (msg.from_user_id && msg.context_token) {
          setContextToken(accountToken, msg.from_user_id, msg.context_token);
        }

        const parsed = await parseILinkMessage(msg, accountToken, accountId).catch(
          (err: unknown) => {
            const errMsg = err instanceof Error ? err.message : String(err);
            process.stderr.write(`[poller] parseILinkMessage 失败: ${errMsg}\n`);
            return undefined;
          },
        );

        if (parsed) {
          scheduleDelivery(parsed.senderId, parsed, onMessage);
        }
      }
    } catch (err: unknown) {
      if (signal.aborted) break;

      failCount++;
      const errMsg = err instanceof Error ? err.message : String(err);
      const isTimeout = err instanceof Error && err.name === "TimeoutError";

      if (!isTimeout) {
        process.stderr.write(
          `[poller] ${accountToken.slice(0, 12)}... getupdates 失败 (${failCount}次): ${errMsg}\n`,
        );
      }

      if (failCount >= 3) {
        updateAccountStatus(accountToken, "offline");
      }

      const pauseMs = failCount >= 3 ? 30_000 : 2_000;
      await new Promise<void>((resolve) => setTimeout(resolve, pauseMs));
    }
  }
}

// ── 轮询管理器 ────────────────────────────────────────────────────────────────

interface AccountPoller {
  readonly accountToken: string;
  readonly abort: AbortController;
}

export function startPoller(onMessage: MessageHandler): () => void {
  const activePollers = new Map<string, AccountPoller>();
  let rescanTimer: NodeJS.Timeout | null = null;
  let stopped = false;

  function startAccountPoller(
    accountToken: string,
    accountId: string,
    baseUrl: string,
  ): void {
    if (activePollers.has(accountToken)) return;

    const abort = new AbortController();
    activePollers.set(accountToken, { accountToken, abort });

    process.stderr.write(
      `[poller] 启动账号轮询: ${accountToken.slice(0, 12)}...\n`,
    );

    pollAccount(accountToken, accountId, baseUrl, abort.signal, onMessage).catch(
      (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[poller] pollAccount 崩溃: ${msg}\n`);
        activePollers.delete(accountToken);
      },
    );
  }

  function stopAccountPoller(accountToken: string): void {
    const poller = activePollers.get(accountToken);
    if (!poller) return;

    poller.abort.abort();
    activePollers.delete(accountToken);
    process.stderr.write(
      `[poller] 停止账号轮询: ${accountToken.slice(0, 12)}...\n`,
    );
  }

  function scanAccounts(): void {
    if (stopped) return;

    const accounts = getAllAccounts().filter((a) => a.status !== "expired");
    const currentTokens = new Set(accounts.map((a) => a.token));

    for (const token of activePollers.keys()) {
      if (!currentTokens.has(token)) {
        stopAccountPoller(token);
      }
    }

    for (const account of accounts) {
      if (!activePollers.has(account.token)) {
        startAccountPoller(account.token, account.accountId, account.baseUrl);
      }
    }

    process.stderr.write(
      `[poller] 账号扫描完成: ${activePollers.size} 个账号轮询中\n`,
    );
  }

  scanAccounts();
  rescanTimer = setInterval(scanAccounts, 60_000);

  return () => {
    stopped = true;
    if (rescanTimer !== null) clearInterval(rescanTimer);

    for (const token of [...activePollers.keys()]) {
      stopAccountPoller(token);
    }

    for (const entry of debounceMap.values()) {
      clearTimeout(entry.timer);
    }
    debounceMap.clear();

    process.stderr.write("[poller] 已停止所有轮询\n");
  };
}
