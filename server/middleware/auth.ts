/**
 * 认证中间件 — API Key + Session Cookie 双模式
 */

import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

const sessions = new Map<string, number>();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function purgeExpired(): void {
  const now = Date.now();
  for (const [token, expiry] of sessions) {
    if (expiry < now) sessions.delete(token);
  }
}

export function createSession(): string {
  purgeExpired();
  const token = randomUUID();
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

export function createApiKeyGuard(apiKey: string) {
  return async function apiKeyGuard(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.url.startsWith("/api/")) return;
    if (request.url === "/api/health" || request.url === "/api/web/login") return;

    // API Key（外部调用）
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      if (token === apiKey) return;
    }

    // Session Cookie（Web UI）
    const sessionCookie = request.cookies.wg_session;
    if (sessionCookie) {
      purgeExpired();
      const expiry = sessions.get(sessionCookie);
      if (expiry !== undefined && expiry > Date.now()) return;
    }

    reply.status(401).send({ success: false, error: "未授权" });
  };
}
