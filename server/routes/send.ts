/**
 * 消息发送 API
 */

import type { FastifyInstance } from "fastify";
import { getAllAccounts } from "../store/account-store.js";
import { getContextToken, findContextToken } from "../store/context-store.js";
import { sendWechatMessage } from "../gateway/ilink-client.js";

/**
 * 找到持有该 userId context_token 的在线账号
 */
function findAccountWithContext(
  userId: string,
  preferredToken?: string,
): { account: { token: string; baseUrl: string }; contextToken: string } | undefined {
  const accounts = getAllAccounts().filter((a) => a.status === "online");

  if (preferredToken) {
    const acc = accounts.find((a) => a.token === preferredToken);
    if (acc) {
      const ct = getContextToken(acc.token, userId);
      if (ct) return { account: acc, contextToken: ct };
    }
  }

  for (const acc of accounts) {
    const ct = getContextToken(acc.token, userId);
    if (ct) return { account: acc, contextToken: ct };
  }

  return undefined;
}

export function registerSendRoutes(app: FastifyInstance): void {
  app.post<{ Body: { userId: string; text: string; accountToken?: string } }>(
    "/api/send",
    async (request, reply) => {
      const body = request.body as {
        userId?: string;
        text?: string;
        accountToken?: string;
      } | undefined;

      if (!body?.userId || !body?.text?.trim()) {
        return reply.status(400).send({
          success: false,
          error: "请提供 userId 和 text",
        });
      }

      const match = findAccountWithContext(body.userId, body.accountToken);

      if (!match) {
        const accounts = getAllAccounts().filter((a) => a.status === "online");
        const fallbackAccount = body.accountToken
          ? accounts.find((a) => a.token === body.accountToken)
          : accounts[0];

        if (!fallbackAccount) {
          return reply.status(404).send({
            success: false,
            error: "找不到可用的 bot 账号",
          });
        }

        const globalToken = findContextToken(fallbackAccount.token, body.userId);
        if (!globalToken) {
          return reply.status(400).send({
            success: false,
            error: "该用户没有 context_token（需要先给 bot 发过消息）",
          });
        }

        const result = await sendWechatMessage(
          fallbackAccount.baseUrl,
          fallbackAccount.token,
          body.userId,
          body.text.trim(),
          globalToken,
        );

        if (!result.success) {
          return reply.status(500).send({
            success: false,
            error: result.error ?? "发送失败",
          });
        }

        return { success: true };
      }

      const result = await sendWechatMessage(
        match.account.baseUrl,
        match.account.token,
        body.userId,
        body.text.trim(),
        match.contextToken,
      );

      if (!result.success) {
        return reply.status(500).send({
          success: false,
          error: result.error ?? "发送失败",
        });
      }

      return { success: true };
    },
  );
}
