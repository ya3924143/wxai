import type { FastifyInstance } from "fastify";

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get("/api/health", async () => ({
    success: true,
    data: { status: "ok", uptime: process.uptime() },
  }));
}
