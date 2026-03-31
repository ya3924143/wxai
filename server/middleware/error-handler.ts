import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  const statusCode = error.statusCode ?? 500;
  const message = statusCode >= 500 ? "服务器内部错误" : error.message;

  if (statusCode >= 500) {
    process.stderr.write(`[ERROR] ${error.message}\n${error.stack ?? ""}\n`);
  }

  reply.status(statusCode).send({ success: false, error: message });
}
