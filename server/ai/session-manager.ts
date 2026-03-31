/**
 * Session 管理器 — Provider 无关
 *
 * 按 userId 维度管理会话：
 * - token 预警时后台生成摘要（60k）
 * - 超限时强制轮转注入摘要（80k）
 * - 空闲超时清理（30 分钟）
 */

/** Session 元数据 */
export interface SessionMeta {
  readonly sessionId: string;
  readonly userId: string;
  readonly createdAt: string;
  readonly totalTokens: number;
  readonly generation: number;
}

/** 内部状态 */
interface ActiveSession {
  meta: SessionMeta;
  /** provider 侧的 session id（如 Claude CLI 的 --resume id） */
  providerSessionId: string;
  totalTokens: number;
  lastActiveAt: number;
  summary: string;
  summaryPending: boolean;
  systemPrompt: string;
  generation: number;
}

const SUMMARY_TRIGGER_TOKENS = 60_000;
const SESSION_TOKEN_LIMIT = 80_000;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const activeSessions = new Map<string, ActiveSession>();

function generateSessionId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `ses-${ts}-${rand}`;
}

/** 构建轮转后的 system prompt */
function buildRotatedSystemPrompt(
  originalSystemPrompt: string,
  summary: string,
): string {
  const parts: string[] = [];
  if (originalSystemPrompt) parts.push(originalSystemPrompt);
  parts.push(
    `[上一段对话摘要 — 以下是之前对话中的关键信息，请基于此继续]\n\n${summary}`,
  );
  return parts.join("\n\n---\n\n");
}

// ── CRUD ──

export function getOrCreate(userId: string): SessionMeta {
  const existing = activeSessions.get(userId);

  if (existing) {
    existing.lastActiveAt = Date.now();
    return {
      ...existing.meta,
      totalTokens: existing.totalTokens,
      generation: existing.generation,
    };
  }

  const meta: SessionMeta = {
    sessionId: generateSessionId(),
    userId,
    createdAt: new Date().toISOString(),
    totalTokens: 0,
    generation: 0,
  };

  activeSessions.set(userId, {
    meta,
    providerSessionId: "",
    totalTokens: 0,
    lastActiveAt: Date.now(),
    summary: "",
    summaryPending: false,
    systemPrompt: "",
    generation: 0,
  });

  return meta;
}

export function getSession(userId: string): ActiveSession | undefined {
  return activeSessions.get(userId);
}

/** 获取 provider 侧 session id（用于 resume 等） */
export function getProviderSessionId(userId: string): string | undefined {
  const session = activeSessions.get(userId);
  return session?.providerSessionId || undefined;
}

/** 更新 provider 侧 session id */
export function setProviderSessionId(
  userId: string,
  providerSessionId: string,
): void {
  const session = activeSessions.get(userId);
  if (session) {
    session.providerSessionId = providerSessionId;
  }
}

/** 更新 system prompt */
export function setSystemPrompt(userId: string, prompt: string): void {
  const session = activeSessions.get(userId);
  if (session) {
    session.systemPrompt = prompt;
  }
}

/** 获取当前有效的 system prompt */
export function getSystemPrompt(userId: string): string {
  return activeSessions.get(userId)?.systemPrompt ?? "";
}

/** 累加 token 用量 */
export function addTokens(userId: string, tokens: number): void {
  const session = activeSessions.get(userId);
  if (session) {
    session.totalTokens += tokens;
    session.lastActiveAt = Date.now();
  }
}

/** 是否需要触发摘要 */
export function needsSummary(userId: string): boolean {
  const session = activeSessions.get(userId);
  if (!session) return false;
  return (
    session.totalTokens >= SUMMARY_TRIGGER_TOKENS &&
    !session.summary &&
    !session.summaryPending
  );
}

/** 标记摘要生成中 */
export function markSummaryPending(userId: string): void {
  const session = activeSessions.get(userId);
  if (session) session.summaryPending = true;
}

/** 设置摘要结果 */
export function setSummary(userId: string, summary: string): void {
  const session = activeSessions.get(userId);
  if (session) {
    session.summary = summary;
    session.summaryPending = false;
  }
}

/** 是否需要轮转 */
export function needsRotation(userId: string): boolean {
  const session = activeSessions.get(userId);
  if (!session) return false;
  return session.totalTokens >= SESSION_TOKEN_LIMIT;
}

/** 执行轮转 */
export function rotate(userId: string): void {
  const old = activeSessions.get(userId);
  if (!old) return;

  const newMeta: SessionMeta = {
    sessionId: generateSessionId(),
    userId,
    createdAt: new Date().toISOString(),
    totalTokens: 0,
    generation: old.generation + 1,
  };

  activeSessions.set(userId, {
    meta: newMeta,
    providerSessionId: "",
    totalTokens: 0,
    lastActiveAt: Date.now(),
    summary: "",
    summaryPending: false,
    systemPrompt: old.summary
      ? buildRotatedSystemPrompt(old.systemPrompt, old.summary)
      : old.systemPrompt,
    generation: old.generation + 1,
  });
}

export function clearSession(userId: string): boolean {
  return activeSessions.delete(userId);
}

export function cleanupIdleSessions(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, session] of activeSessions) {
    if (now - session.lastActiveAt > IDLE_TIMEOUT_MS) {
      activeSessions.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

export function listActiveSessions(): readonly SessionMeta[] {
  return Array.from(activeSessions.values()).map((s) => ({
    ...s.meta,
    totalTokens: s.totalTokens,
    generation: s.generation,
  }));
}

/** 摘要 prompt（供 provider 使用） */
export const SUMMARY_PROMPT = `你正在和用户进行多轮对话。现在需要总结对话，因为即将开始新的会话。
请提取以下关键信息，用结构化格式输出：

1. **用户身份和偏好**（如有）
2. **讨论的核心话题**（按重要性排序）
3. **已达成的结论或决定**
4. **未完成的任务或待办**
5. **重要的数字、日期、名称等事实**

只保留对后续对话有用的信息，不要复述对话过程。控制在 500 字以内。`;
