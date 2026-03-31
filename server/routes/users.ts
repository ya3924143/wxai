/**
 * 用户管理 API
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getAllUsers,
  findUser,
  addUser,
  removeUser,
  setPermission,
} from "../store/user-store.js";

const addUserSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  chat: z.boolean().optional().default(true),
});

const permissionSchema = z.object({
  chat: z.boolean(),
});

export function registerUsersRoutes(app: FastifyInstance): void {
  app.get("/api/manage/users", async () => ({
    success: true,
    data: getAllUsers(),
  }));

  app.post("/api/manage/users", async (request, reply) => {
    const parsed = addUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }
    const user = addUser(parsed.data.userId, parsed.data.name, parsed.data.chat);
    return { success: true, data: user };
  });

  app.delete<{ Params: { userId: string } }>(
    "/api/manage/users/:userId",
    async (request) => {
      removeUser(decodeURIComponent(request.params.userId));
      return { success: true };
    },
  );

  app.put<{ Params: { userId: string } }>(
    "/api/manage/users/:userId/permissions",
    async (request, reply) => {
      const parsed = permissionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
        });
      }
      setPermission(decodeURIComponent(request.params.userId), parsed.data.chat);
      return { success: true };
    },
  );
}
