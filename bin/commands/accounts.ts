/**
 * wxai accounts — 列出所有微信账号
 */

import { ensureDataDir } from "../../server/config.js";
import { getAllAccounts } from "../../server/store/account-store.js";

export async function accountsCommand(): Promise<void> {
  ensureDataDir();
  const accounts = getAllAccounts();

  if (accounts.length === 0) {
    process.stdout.write("暂无微信账号，请运行 wxai login 扫码登录\n");
    return;
  }

  process.stdout.write(`共 ${accounts.length} 个账号:\n\n`);

  for (const account of accounts) {
    const status =
      account.status === "online"
        ? "\x1b[32m在线\x1b[0m"
        : account.status === "offline"
          ? "\x1b[31m离线\x1b[0m"
          : "\x1b[33m过期\x1b[0m";

    process.stdout.write(
      `  ${account.label} (${account.accountId.slice(0, 12)}...) — ${status}\n`,
    );

    if (account.lastKeepAlive) {
      process.stdout.write(`    最后保活: ${account.lastKeepAlive}\n`);
    }
  }

  process.stdout.write("\n");
}
