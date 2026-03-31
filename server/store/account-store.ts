/**
 * 账号 JSON 持久化 — 不可变更新
 */

import { ACCOUNTS_PATH } from "../config.js";
import type { WechatAccount } from "../types.js";
import { readJsonFile, writeJsonFile } from "./json-file.js";

function readAccounts(): readonly WechatAccount[] {
  return readJsonFile<WechatAccount[]>(ACCOUNTS_PATH, []);
}

function writeAccounts(accounts: readonly WechatAccount[]): void {
  writeJsonFile(ACCOUNTS_PATH, accounts);
}

export function getAllAccounts(): readonly WechatAccount[] {
  return readAccounts();
}

export function getAccountByToken(token: string): WechatAccount | undefined {
  return readAccounts().find((a) => a.token === token);
}

export function getFirstOnlineAccount(): WechatAccount | undefined {
  return readAccounts().find((a) => a.status === "online");
}

export function addAccount(account: WechatAccount): readonly WechatAccount[] {
  const existing = readAccounts();
  const idx = existing.findIndex((a) => a.token === account.token);
  const updated =
    idx >= 0
      ? existing.map((a, i) => (i === idx ? account : a))
      : [...existing, account];
  writeAccounts(updated);
  return updated;
}

export function updateAccountStatus(
  token: string,
  status: WechatAccount["status"],
  lastKeepAlive?: string,
): void {
  const accounts = readAccounts();
  const updated = accounts.map((a) =>
    a.token === token
      ? { ...a, status, ...(lastKeepAlive ? { lastKeepAlive } : {}) }
      : a,
  );
  writeAccounts(updated);
}

export function updateAccountKeepaliveExclude(
  token: string,
  keepaliveExclude: boolean,
): void {
  const accounts = readAccounts();
  const updated = accounts.map((a) =>
    a.token === token ? { ...a, keepaliveExclude } : a,
  );
  writeAccounts(updated);
}

export function removeAccount(token: string): void {
  const updated = readAccounts().filter((a) => a.token !== token);
  writeAccounts(updated);
}
