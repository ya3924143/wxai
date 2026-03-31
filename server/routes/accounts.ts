/**
 * 账号管理 API
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getAllAccounts,
  addAccount,
  removeAccount,
  updateAccountKeepaliveExclude,
} from "../store/account-store.js";
import {
  getAllContextTokens,
  findContextToken,
  setContextToken,
} from "../store/context-store.js";
import { getQrCode, pollQrStatus } from "../gateway/ilink-client.js";

const keepaliveExcludeSchema = z.object({
  exclude: z.boolean(),
});

const contextTokenWriteSchema = z.object({
  userId: z.string().min(1),
  contextToken: z.string().min(1),
});

export function registerAccountsRoutes(app: FastifyInstance): void {
  // 列出所有账号
  app.get("/api/accounts", async () => {
    const accounts = getAllAccounts();
    return {
      success: true,
      data: accounts.map((a) => ({
        token: a.token,
        accountId: a.accountId,
        label: a.label,
        userId: a.userId,
        status: a.status,
        lastKeepAlive: a.lastKeepAlive,
        savedAt: a.savedAt,
      })),
    };
  });

  // 获取所有用户列表（跨账号合并）
  app.get("/api/users", async () => {
    const accounts = getAllAccounts();
    const seen = new Set<string>();
    const users: {
      userId: string;
      hasContextToken: boolean;
      accountLabel: string;
    }[] = [];

    for (const account of accounts) {
      const tokens = getAllContextTokens(account.token);
      for (const [userId, token] of Object.entries(tokens)) {
        if (seen.has(userId)) continue;
        seen.add(userId);
        users.push({
          userId,
          hasContextToken: token.length > 0,
          accountLabel: account.label,
        });
      }
    }

    return { success: true, data: users };
  });

  // 开始扫码登录
  app.post("/api/accounts/qr/start", async (_request, reply) => {
    try {
      const qr = await getQrCode();
      return { success: true, data: qr };
    } catch (err: unknown) {
      return reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : "获取二维码失败",
      });
    }
  });

  // 轮询扫码状态
  app.get<{ Querystring: { qrcode: string } }>(
    "/api/accounts/qr/status",
    async (request, reply) => {
      const qrcode = (request.query as { qrcode?: string }).qrcode;
      if (!qrcode) {
        return reply.status(400).send({
          success: false,
          error: "请提供 qrcode 参数",
        });
      }

      try {
        const status = await pollQrStatus(qrcode);

        if (status.status === "confirmed" && status.token) {
          addAccount({
            token: status.token,
            baseUrl: status.baseUrl ?? "https://ilinkai.weixin.qq.com",
            accountId: status.accountId ?? "",
            userId: status.userId,
            label: status.accountId?.slice(0, 8) ?? "new",
            savedAt: new Date().toISOString(),
            status: "online",
          });
        }

        return { success: true, data: status };
      } catch (err: unknown) {
        return reply.status(500).send({
          success: false,
          error: err instanceof Error ? err.message : "轮询失败",
        });
      }
    },
  );

  // 删除账号
  app.delete<{ Params: { token: string } }>(
    "/api/accounts/:token",
    async (request) => {
      removeAccount(request.params.token);
      return { success: true };
    },
  );

  // 查询某账号下指定 userId 的 context token
  app.get<{ Params: { token: string; userId: string } }>(
    "/api/accounts/:token/context-tokens/:userId",
    async (request) => {
      const { token, userId } = request.params;
      const contextToken = findContextToken(token, userId);
      const hasToken = contextToken !== undefined && contextToken.length > 0;
      return {
        success: true,
        data: { userId, hasToken, ...(hasToken ? { contextToken } : {}) },
      };
    },
  );

  // 设置 keepalive-exclude
  app.put<{ Params: { token: string } }>(
    "/api/accounts/:token/keepalive-exclude",
    async (request, reply) => {
      const parsed = keepaliveExcludeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
        });
      }
      const { token } = request.params;
      updateAccountKeepaliveExclude(token, parsed.data.exclude);
      return { success: true, data: { token, keepaliveExclude: parsed.data.exclude } };
    },
  );

  // 写回 context token
  app.put<{ Params: { token: string } }>(
    "/api/accounts/:token/context-tokens",
    async (request, reply) => {
      const parsed = contextTokenWriteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
        });
      }
      const { token } = request.params;
      const { userId, contextToken } = parsed.data;
      setContextToken(token, userId, contextToken);
      return { success: true, data: { userId, contextToken } };
    },
  );
}
