#!/usr/bin/env node --import tsx

/**
 * wxai CLI — 微信 AI 机器人命令行工具
 *
 * 用法:
 *   wxai init          交互式初始化配置
 *   wxai login         终端扫码登录微信
 *   wxai accounts      列出所有微信账号
 *   wxai start         启动服务（前台）
 *   wxai start -d      PM2 守护进程启动
 *   wxai stop          停止 PM2 进程
 *   wxai status        查看运行状态
 *   wxai user list     列出用户
 *   wxai user allow    允许用户使用
 *   wxai plugin list   列出插件
 */

import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { accountsCommand } from "./commands/accounts.js";
import { startCommand, stopCommand, statusCommand } from "./commands/service.js";

const program = new Command();

program
  .name("wxai")
  .description("WeChat AI Bot — Connect your WeChat to any AI with one scan")
  .version("0.1.0");

program
  .command("login")
  .description("扫码登录微信（终端显示二维码）")
  .action(loginCommand);

program
  .command("accounts")
  .description("列出所有微信账号")
  .action(accountsCommand);

program
  .command("start")
  .description("启动 wxai 服务")
  .option("-d, --daemon", "PM2 守护进程模式")
  .action(startCommand);

program
  .command("stop")
  .description("停止 wxai 服务")
  .action(stopCommand);

program
  .command("status")
  .description("查看服务运行状态")
  .action(statusCommand);

program.parse();
