/**
 * Claude CLI Provider — 通过 spawn `claude -p` 调用本机 Claude Code
 *
 * 无需 API Key，使用本机已登录的 Claude 账号。
 */

import { execFile } from "child_process";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir, homedir } from "os";
import { randomUUID } from "crypto";
import type { AiProvider, AiResponse, ChatOptions, SessionOptions, ModelTier, ImageInput } from "../types.js";
import {
  globalQueue,
  withRetry,
  PRIORITY_CHAT,
  PRIORITY_SESSION,
  PRIORITY_SUMMARY,
} from "../request-queue.js";
import * as sessions from "../session-manager.js";

// ── CLI 模型映射 ──

const MODEL_FLAGS: Record<ModelTier, string> = {
  fast: "claude-haiku-4-5",
  balanced: "claude-sonnet-4-6",
  powerful: "claude-opus-4-6",
};

// ── CLI 响应类型 ──

interface CliJsonResponse {
  readonly type: string;
  readonly result: string;
  readonly session_id: string;
  readonly is_error: boolean;
  readonly duration_ms: number;
  readonly num_turns: number;
  readonly total_cost_usd: number;
  readonly stop_reason: string;
  readonly usage: {
    readonly input_tokens: number;
    readonly output_tokens: number;
    readonly cache_creation_input_tokens: number;
    readonly cache_read_input_tokens: number;
  };
}

// ── 常量 ──

const MAX_BUFFER = 10 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 600_000;
const WORKSPACES_ROOT = join(homedir(), ".wxai", "workspaces");
const IMAGE_TMP_DIR = join(tmpdir(), "wxai-images");

// ── 工具函数 ──

function sanitizeDirName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

async function getIsolatedCwd(userId: string): Promise<string> {
  const dir = join(WORKSPACES_ROOT, sanitizeDirName(userId));
  await mkdir(dir, { recursive: true });
  return dir;
}

function execClaudeAsync(
  args: readonly string[],
  options: { cwd?: string; timeout: number },
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "claude",
      args,
      {
        cwd: options.cwd,
        timeout: options.timeout,
        maxBuffer: MAX_BUFFER,
      },
      (error, stdout) => {
        if (error) {
          const out = (stdout || "").trim();
          if (out && out.includes("{")) {
            resolve(out);
          } else {
            const detail = error.killed
              ? `超时 (${options.timeout}ms)`
              : error.message;
            reject(new Error(`claude CLI 执行失败: ${detail}`));
          }
        } else {
          resolve((stdout || "").trim());
        }
      },
    );
  });
}

function parseCliResponse(raw: string): CliJsonResponse {
  const jsonStart = raw.indexOf("{");
  const jsonStr = jsonStart > 0 ? raw.slice(jsonStart) : raw;
  return JSON.parse(jsonStr) as CliJsonResponse;
}

function toAiResponse(parsed: CliJsonResponse, tier: ModelTier): AiResponse {
  const text = parsed.result ?? "";
  const isTruncated = !text && parsed.stop_reason === "tool_use";

  return {
    text: isTruncated
      ? `[被截断] Claude 在 ${parsed.num_turns ?? 0} 轮后仍在执行工具调用。`
      : text,
    model: MODEL_FLAGS[tier],
    inputTokens: parsed.usage?.input_tokens ?? 0,
    outputTokens: parsed.usage?.output_tokens ?? 0,
    costUsd: parsed.total_cost_usd ?? 0,
    durationMs: parsed.duration_ms ?? 0,
    isError: isTruncated ? false : (parsed.is_error ?? false),
  };
}

// ── 图片处理 ──

function mediaTypeToExt(mediaType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
  };
  return map[mediaType] ?? ".jpg";
}

async function saveImagesToTemp(
  images: readonly ImageInput[],
): Promise<readonly string[]> {
  await mkdir(IMAGE_TMP_DIR, { recursive: true });
  const paths: string[] = [];
  for (const img of images) {
    const ext = mediaTypeToExt(img.mediaType);
    const filepath = join(IMAGE_TMP_DIR, `img-${randomUUID()}${ext}`);
    await writeFile(filepath, Buffer.from(img.data, "base64"));
    paths.push(filepath);
  }
  return paths;
}

function cleanupTempImages(paths: readonly string[]): void {
  for (const p of paths) {
    unlink(p).catch(() => {});
  }
}

function buildImagePrompt(text: string, imagePaths: readonly string[]): string {
  const imageRefs = imagePaths
    .map((p, i) =>
      `[图片${imagePaths.length > 1 ? ` ${i + 1}` : ""}: ${p}]`,
    )
    .join("\n");

  const userText = text.trim();
  if (userText) {
    return `用户发送了图片，请先读取图片再结合用户的文字回复。\n\n${imageRefs}\n\n用户说: ${userText}`;
  }
  return `用户发送了图片，请先读取图片内容再回复。\n\n${imageRefs}`;
}

// ── 核心调用 ──

async function queryClaudeCode(
  prompt: string,
  options: {
    systemPrompt?: string;
    model?: ModelTier;
    maxTurns?: number;
    resume?: string;
    cwd?: string;
    timeoutMs?: number;
  } = {},
): Promise<{ parsed: CliJsonResponse; tier: ModelTier }> {
  const tier = options.model ?? "balanced";
  const args: string[] = [
    "-p",
    prompt,
    "--output-format",
    "json",
    "--max-turns",
    String(options.maxTurns ?? 1),
  ];

  args.push("--model", MODEL_FLAGS[tier]);

  if (options.systemPrompt) {
    args.push("--system-prompt", options.systemPrompt);
  }

  if (options.resume) {
    args.push("--resume", options.resume);
  }

  const raw = await execClaudeAsync(args, {
    cwd: options.cwd,
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  return { parsed: parseCliResponse(raw), tier };
}

function queuedQuery(
  prompt: string,
  options: Parameters<typeof queryClaudeCode>[1],
  priority: number,
): Promise<{ parsed: CliJsonResponse; tier: ModelTier }> {
  return globalQueue.enqueue(
    withRetry(() => queryClaudeCode(prompt, options)),
    priority,
  );
}

// ── Provider 实现 ──

export function createClaudeCliProvider(): AiProvider {
  return {
    id: "claude-cli",
    name: "Claude Code CLI",

    async chat(content: string, options?: ChatOptions): Promise<AiResponse> {
      const tier = options?.modelTier ?? "fast";
      const cwd = await getIsolatedCwd("_chat_oneshot");

      let prompt = content;
      let imagePaths: readonly string[] = [];

      if (options?.images && options.images.length > 0) {
        imagePaths = await saveImagesToTemp(options.images);
        prompt = buildImagePrompt(content, imagePaths);
      }

      try {
        const { parsed } = await queuedQuery(
          prompt,
          {
            systemPrompt: options?.systemPrompt,
            model: tier,
            maxTurns: options?.maxTurns ?? 1,
            cwd,
            timeoutMs: options?.timeoutMs,
          },
          PRIORITY_CHAT,
        );
        return toAiResponse(parsed, tier);
      } finally {
        if (imagePaths.length > 0) cleanupTempImages(imagePaths);
      }
    },

    async sessionSend(
      userId: string,
      content: string,
      options?: SessionOptions,
    ): Promise<AiResponse> {
      sessions.getOrCreate(userId);
      const tier = options?.modelTier ?? "balanced";
      const cwd = await getIsolatedCwd(userId);

      if (options?.systemPrompt) {
        sessions.setSystemPrompt(userId, options.systemPrompt);
      }

      // 图片预处理
      let prompt = content;
      let imagePaths: readonly string[] = [];

      if (options?.images && options.images.length > 0) {
        imagePaths = await saveImagesToTemp(options.images);
        prompt = buildImagePrompt(content, imagePaths);
      }

      const baseTurns = options?.maxTurns ?? 1;
      const maxTurns = imagePaths.length > 0 ? Math.max(baseTurns, 2) : baseTurns;

      try {
        // 轮转检查
        if (sessions.needsRotation(userId)) {
          sessions.rotate(userId);
        }

        // 预警：触发后台摘要
        if (sessions.needsSummary(userId)) {
          sessions.markSummaryPending(userId);
          const resumeId = sessions.getProviderSessionId(userId);
          if (resumeId) {
            queuedQuery(
              sessions.SUMMARY_PROMPT,
              { resume: resumeId, model: "fast", maxTurns: 1, cwd },
              PRIORITY_SUMMARY,
            )
              .then(({ parsed }) => sessions.setSummary(userId, parsed.result ?? ""))
              .catch(() => sessions.setSummary(userId, ""));
          }
        }

        const systemPrompt = sessions.getSystemPrompt(userId) || options?.systemPrompt;
        const resumeId = sessions.getProviderSessionId(userId);

        const { parsed } = await queuedQuery(
          prompt,
          {
            systemPrompt,
            model: tier,
            maxTurns,
            cwd,
            timeoutMs: options?.timeoutMs,
            resume: resumeId,
          },
          PRIORITY_SESSION,
        );

        // 更新 session 状态
        if (parsed.session_id) {
          sessions.setProviderSessionId(userId, parsed.session_id);
        }
        sessions.addTokens(
          userId,
          (parsed.usage?.input_tokens ?? 0) + (parsed.usage?.output_tokens ?? 0),
        );

        return toAiResponse(parsed, tier);
      } finally {
        if (imagePaths.length > 0) cleanupTempImages(imagePaths);
      }
    },

    async clearSession(userId: string): Promise<void> {
      sessions.clearSession(userId);
    },

    async healthCheck(): Promise<boolean> {
      try {
        const raw = await execClaudeAsync(["--version"], { timeout: 5_000 });
        return raw.length > 0;
      } catch {
        return false;
      }
    },
  };
}
