/**
 * Provider 工厂 — 根据配置创建 AI Provider 实例
 */

import type { AiProvider } from "./types.js";
import { createClaudeCliProvider } from "./providers/claude-cli.js";

export type ProviderType = "claude-cli" | "anthropic-api" | "openai-compat";

export function createProvider(type?: ProviderType): AiProvider {
  const providerType =
    type ?? (process.env["WXAI_AI_PROVIDER"] as ProviderType | undefined) ?? "claude-cli";

  switch (providerType) {
    case "claude-cli":
      return createClaudeCliProvider();

    case "anthropic-api":
      // TODO: Phase 2 扩展 — Anthropic REST API provider
      throw new Error(
        "anthropic-api provider 尚未实现，请使用 claude-cli 或等待后续版本",
      );

    case "openai-compat":
      // TODO: Phase 2 扩展 — OpenAI 兼容 provider
      throw new Error(
        "openai-compat provider 尚未实现，请使用 claude-cli 或等待后续版本",
      );

    default:
      throw new Error(`未知的 AI provider 类型: ${providerType}`);
  }
}
