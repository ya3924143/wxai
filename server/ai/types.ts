/**
 * AI Provider 抽象接口
 *
 * 所有 AI 后端（Claude CLI、Anthropic API、OpenAI 等）统一实现此接口。
 */

/** 模型能力等级（provider 内部映射到具体模型） */
export type ModelTier = "fast" | "balanced" | "powerful";

/** Base64 编码的图片 */
export interface ImageInput {
  readonly data: string;
  readonly mediaType: string;
}

/** 对话选项 */
export interface ChatOptions {
  readonly systemPrompt?: string;
  readonly modelTier?: ModelTier;
  readonly maxTurns?: number;
  readonly images?: readonly ImageInput[];
  readonly timeoutMs?: number;
}

/** Session 对话选项 */
export interface SessionOptions extends ChatOptions {
  /** 会话标识（provider 内部管理） */
  readonly sessionKey?: string;
}

/** AI 响应 */
export interface AiResponse {
  readonly text: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
  readonly durationMs: number;
  readonly isError: boolean;
}

/** AI Provider 接口 */
export interface AiProvider {
  readonly id: string;
  readonly name: string;

  /** 单轮问答（无上下文） */
  chat(content: string, options?: ChatOptions): Promise<AiResponse>;

  /** 多轮对话（有上下文，自动管理 session） */
  sessionSend(
    userId: string,
    content: string,
    options?: SessionOptions,
  ): Promise<AiResponse>;

  /** 清除用户 session */
  clearSession(userId: string): Promise<void>;

  /** 健康检查 */
  healthCheck(): Promise<boolean>;
}
