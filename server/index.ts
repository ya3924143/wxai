/**
 * wxai — 主入口
 *
 * 微信 AI 机器人：扫码登录、消息轮询、AI 对话、插件系统
 */

import "dotenv/config";
import { resolve } from "node:path";
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { loadConfig } from "./config.js";
import { createApiKeyGuard, createSession } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error-handler.js";
import { registerSendRoutes } from "./routes/send.js";
import { registerAccountsRoutes } from "./routes/accounts.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerUsersRoutes } from "./routes/users.js";
import { registerPluginsRoutes } from "./routes/plugins.js";
import { startKeepAlive } from "./gateway/keepalive.js";
import { startPoller } from "./gateway/poller.js";
import { createProvider } from "./ai/provider-factory.js";
import { createMessageHandler } from "./chatbot/handler.js";
import { cleanupIdleSessions } from "./ai/session-manager.js";
import { registerPlugin } from "./plugins/loader.js";
import { echoPlugin } from "./plugins/builtin/echo.js";

async function main(): Promise<void> {
  const config = loadConfig();

  const apiKey = process.env.WXAI_API_KEY;
  if (!apiKey) {
    process.stderr.write("错误: 请在 .env 中设置 WXAI_API_KEY\n");
    process.exit(1);
  }

  const app = Fastify({ logger: true });

  await app.register(fastifyCookie);
  await app.register(fastifyCors, { origin: true, credentials: true });
  app.setErrorHandler(errorHandler);

  // 认证
  app.addHook("onRequest", createApiKeyGuard(apiKey));

  // Web 登录
  app.post("/api/web/login", async (request, reply) => {
    const body = request.body as { password?: string } | undefined;
    const password = process.env.WXAI_PASSWORD ?? apiKey;

    if (body?.password !== password) {
      return reply.status(401).send({ success: false, error: "密码错误" });
    }

    const sessionToken = createSession();
    reply.setCookie("wg_session", sessionToken, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 24 * 60 * 60,
    });

    return { success: true };
  });

  // 路由
  registerSendRoutes(app);
  registerAccountsRoutes(app);
  registerUsersRoutes(app);
  registerPluginsRoutes(app);
  registerHealthRoutes(app);

  // 静态文件（Web UI）
  const uiDistPath = resolve(process.cwd(), "ui", "dist");
  await app.register(fastifyStatic, {
    root: uiDistPath,
    prefix: "/",
    wildcard: false,
  });

  app.setNotFoundHandler((_request, reply) => {
    if (!_request.url.startsWith("/api/")) {
      return reply.sendFile("index.html");
    }
    reply.status(404).send({ success: false, error: "接口不存在" });
  });

  await app.listen({ port: config.port, host: config.host });

  // 创建 AI Provider
  const ai = createProvider();
  const aiHealthy = await ai.healthCheck();
  process.stderr.write(
    `[wxai] AI Provider: ${ai.name} (${aiHealthy ? "可用" : "不可用"})\n`,
  );

  // 注册内置插件
  registerPlugin(echoPlugin);

  // 创建消息处理器（poller → handler 直接调用）
  const handleMessages = createMessageHandler(ai, config);

  // 启动保活
  startKeepAlive(config);

  // 启动轮询
  startPoller(handleMessages);

  // 定时清理空闲 session（每 10 分钟）
  setInterval(() => {
    const cleaned = cleanupIdleSessions();
    if (cleaned > 0) {
      process.stderr.write(`[wxai] 清理 ${cleaned} 个空闲 session\n`);
    }
  }, 10 * 60 * 1000);

  process.stderr.write(
    `wxai 已启动: http://${config.host}:${config.port}\n`,
  );
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`启动失败: ${msg}\n`);
  process.exit(1);
});
