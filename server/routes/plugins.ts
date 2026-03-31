/**
 * 插件管理 API
 */

import type { FastifyInstance } from "fastify";
import { getRegisteredPlugins } from "../plugins/loader.js";

export function registerPluginsRoutes(app: FastifyInstance): void {
  app.get("/api/plugins", async () => {
    const plugins = getRegisteredPlugins();
    return {
      success: true,
      data: plugins.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        triggers: p.triggers,
        schedule: p.schedule ?? null,
      })),
    };
  });
}
