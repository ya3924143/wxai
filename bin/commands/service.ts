/**
 * wxai start/stop/status — 服务管理
 */

import { execSync } from "child_process";
import { resolve } from "path";

const PROJECT_DIR = resolve(import.meta.dirname, "../..");

export async function startCommand(options: {
  daemon?: boolean;
}): Promise<void> {
  if (options.daemon) {
    process.stdout.write("以 PM2 守护进程模式启动...\n");
    try {
      execSync(`pm2 start ecosystem.config.cjs`, {
        cwd: PROJECT_DIR,
        stdio: "inherit",
      });
    } catch {
      process.stderr.write("PM2 启动失败，请确认 pm2 已安装\n");
      process.exit(1);
    }
  } else {
    process.stdout.write("以前台模式启动...\n");
    process.stdout.write("(Ctrl+C 停止)\n\n");
    try {
      execSync(`node --import tsx server/index.ts`, {
        cwd: PROJECT_DIR,
        stdio: "inherit",
      });
    } catch {
      // Ctrl+C 退出
    }
  }
}

export async function stopCommand(): Promise<void> {
  try {
    execSync("pm2 stop wxai", { stdio: "inherit" });
    process.stdout.write("wxai 已停止\n");
  } catch {
    process.stderr.write("停止失败，wxai 可能未在运行\n");
  }
}

export async function statusCommand(): Promise<void> {
  try {
    execSync("pm2 describe wxai", { stdio: "inherit" });
  } catch {
    process.stdout.write("wxai 未通过 PM2 运行\n");
    process.stdout.write("使用 wxai start -d 启动守护进程\n");
  }
}
