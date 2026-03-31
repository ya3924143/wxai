/**
 * wxai login — 终端扫码登录微信
 */

import qrcode from "qrcode-terminal";
import { getQrCode, pollQrStatus } from "../../server/gateway/ilink-client.js";
import { ensureDataDir } from "../../server/config.js";
import { addAccount } from "../../server/store/account-store.js";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function loginCommand(): Promise<void> {
  ensureDataDir();

  process.stdout.write("正在获取登录二维码...\n");

  let qr;
  try {
    qr = await getQrCode();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`获取二维码失败: ${msg}\n`);
    process.exit(1);
  }

  // 在终端渲染二维码
  process.stdout.write("\n请使用微信扫描以下二维码:\n\n");
  qrcode.generate(qr.qrcode, { small: true }, (code: string) => {
    process.stdout.write(code + "\n");
  });

  process.stdout.write("\n等待扫码确认...\n");

  // 轮询扫码状态
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await delay(2_000);

    try {
      const status = await pollQrStatus(qr.qrcode);

      switch (status.status) {
        case "scaned":
          process.stdout.write("已扫码，等待确认...\n");
          break;

        case "confirmed":
          if (status.token) {
            const account = {
              token: status.token,
              baseUrl: status.baseUrl ?? "https://ilinkai.weixin.qq.com",
              accountId: status.accountId ?? "",
              userId: status.userId,
              label: status.accountId?.slice(0, 8) ?? "new",
              savedAt: new Date().toISOString(),
              status: "online" as const,
            };
            addAccount(account);
            process.stdout.write(
              `\n登录成功! 账号: ${account.accountId}\n`,
            );
            process.stdout.write(
              `Token 已保存到 ~/.wxai/accounts.json\n`,
            );
            process.stdout.write(
              `\n运行 \`wxai start\` 启动服务\n`,
            );
          }
          return;

        case "expired":
          process.stderr.write("\n二维码已过期，请重新执行 wxai login\n");
          process.exit(1);

        case "wait":
        default:
          break;
      }
    } catch {
      // 轮询偶尔失败，继续重试
    }
  }

  process.stderr.write("\n等待超时，请重新执行 wxai login\n");
  process.exit(1);
}
