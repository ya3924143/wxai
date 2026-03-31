# AI Provider Development Guide

This guide explains how to add a new AI provider to wxai. The provider abstraction lets you connect wxai to **any** AI backend — cloud APIs, local models, or custom pipelines.

## Overview

wxai uses the `AiProvider` interface defined in `server/ai/types.ts`. Implement 4 methods and register your provider in the factory — that's it.

## The AiProvider Interface

```typescript
interface AiProvider {
  /** Unique identifier (e.g. "openai", "ollama") */
  readonly id: string;
  /** Display name (e.g. "OpenAI GPT") */
  readonly name: string;

  /** Single-turn chat — no context, no session */
  chat(content: string, options?: ChatOptions): Promise<AiResponse>;

  /** Multi-turn conversation — wxai manages sessions per userId */
  sessionSend(userId: string, content: string, options?: SessionOptions): Promise<AiResponse>;

  /** Clear a user's conversation history */
  clearSession(userId: string): Promise<void>;

  /** Return true if the AI backend is reachable */
  healthCheck(): Promise<boolean>;
}
```

### Types

```typescript
/** Model capability tier — map to your actual models */
type ModelTier = "fast" | "balanced" | "powerful";

interface ChatOptions {
  readonly systemPrompt?: string;
  readonly modelTier?: ModelTier;      // which tier to use
  readonly maxTurns?: number;          // for multi-step/tool-use models
  readonly images?: readonly ImageInput[];
  readonly timeoutMs?: number;
}

interface SessionOptions extends ChatOptions {
  readonly sessionKey?: string;        // provider can use or ignore
}

interface ImageInput {
  readonly data: string;               // base64 encoded
  readonly mediaType: string;          // "image/jpeg", "image/png", etc.
}

interface AiResponse {
  readonly text: string;               // the AI's response text
  readonly model: string;              // actual model name used
  readonly inputTokens: number;        // 0 if unknown
  readonly outputTokens: number;       // 0 if unknown
  readonly costUsd: number;            // 0 if free/unknown
  readonly durationMs: number;         // response time
  readonly isError: boolean;           // true if the response is an error
}
```

## Step-by-Step: Create a Provider

### 1. Create the provider file

```
server/ai/providers/my-provider.ts
```

### 2. Implement the interface

Here's a complete **OpenAI-compatible** provider example:

```typescript
// server/ai/providers/openai-compat.ts

import type {
  AiProvider,
  AiResponse,
  ChatOptions,
  SessionOptions,
  ModelTier,
} from "../types.js";

// ── Model mapping ──

const MODELS: Record<ModelTier, string> = {
  fast: process.env["OPENAI_MODEL_FAST"] ?? "gpt-4o-mini",
  balanced: process.env["OPENAI_MODEL"] ?? "gpt-4o",
  powerful: process.env["OPENAI_MODEL_POWERFUL"] ?? "gpt-4o",
};

// ── Session store (in-memory) ──

interface Session {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  lastActiveAt: number;
}

const sessions = new Map<string, Session>();

function getOrCreateSession(userId: string, systemPrompt?: string): Session {
  let session = sessions.get(userId);
  if (!session) {
    session = {
      messages: systemPrompt ? [{ role: "system", content: systemPrompt }] : [],
      lastActiveAt: Date.now(),
    };
    sessions.set(userId, session);
  }
  session.lastActiveAt = Date.now();
  return session;
}

// ── API call ──

async function callOpenAI(
  messages: Array<{ role: string; content: string }>,
  model: string,
  timeoutMs: number,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const baseUrl = process.env["OPENAI_BASE_URL"] ?? "https://api.openai.com/v1";
  const apiKey = process.env["OPENAI_API_KEY"];

  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 4096 }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI API error: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    text: data.choices[0]?.message.content ?? "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

// ── Provider factory ──

export function createOpenAICompatProvider(): AiProvider {
  return {
    id: "openai-compat",
    name: "OpenAI Compatible",

    async chat(content: string, options?: ChatOptions): Promise<AiResponse> {
      const model = MODELS[options?.modelTier ?? "balanced"];
      const messages = [
        ...(options?.systemPrompt ? [{ role: "system" as const, content: options.systemPrompt }] : []),
        { role: "user" as const, content },
      ];

      const start = Date.now();
      const result = await callOpenAI(messages, model, options?.timeoutMs ?? 60_000);

      return {
        text: result.text,
        model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: 0, // calculate if needed
        durationMs: Date.now() - start,
        isError: false,
      };
    },

    async sessionSend(
      userId: string,
      content: string,
      options?: SessionOptions,
    ): Promise<AiResponse> {
      const session = getOrCreateSession(userId, options?.systemPrompt);
      session.messages.push({ role: "user", content });

      const model = MODELS[options?.modelTier ?? "balanced"];
      const start = Date.now();
      const result = await callOpenAI(session.messages, model, options?.timeoutMs ?? 60_000);

      session.messages.push({ role: "assistant", content: result.text });

      // Simple token limit: trim old messages if too many
      if (session.messages.length > 40) {
        const system = session.messages.find((m) => m.role === "system");
        session.messages = [
          ...(system ? [system] : []),
          ...session.messages.slice(-20),
        ];
      }

      return {
        text: result.text,
        model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: 0,
        durationMs: Date.now() - start,
        isError: false,
      };
    },

    async clearSession(userId: string): Promise<void> {
      sessions.delete(userId);
    },

    async healthCheck(): Promise<boolean> {
      try {
        const baseUrl = process.env["OPENAI_BASE_URL"] ?? "https://api.openai.com/v1";
        const res = await fetch(`${baseUrl}/models`, {
          headers: { Authorization: `Bearer ${process.env["OPENAI_API_KEY"] ?? ""}` },
          signal: AbortSignal.timeout(5_000),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}
```

### 3. Register in the factory

Edit `server/ai/provider-factory.ts`:

```typescript
import { createOpenAICompatProvider } from "./providers/openai-compat.js";

export function createProvider(type?: ProviderType): AiProvider {
  switch (providerType) {
    case "claude-cli":
      return createClaudeCliProvider();
    case "openai-compat":                    // ← add this
      return createOpenAICompatProvider();   // ← add this
    // ...
  }
}
```

### 4. Set env variable

```env
WXAI_AI_PROVIDER=openai-compat
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1    # or any compatible endpoint
OPENAI_MODEL=gpt-4o                           # balanced tier
OPENAI_MODEL_FAST=gpt-4o-mini                 # fast tier
OPENAI_MODEL_POWERFUL=gpt-4o                  # powerful tier
```

## Model Tier System

wxai routes messages to different model tiers based on content:

| Tier | When | Examples |
|------|------|---------|
| `powerful` | Analysis, search, coding, follow-up requests | "分析这个...", "搜索...", "详细说..." |
| `balanced` | General conversation | Most messages |
| `fast` | One-shot chat, summaries (internal) | Background tasks |

Your provider maps these tiers to actual model names. The chatbot layer decides which tier to use — your provider just needs to respect it.

## Session Management

wxai includes a built-in session manager (`server/ai/session-manager.ts`) that handles:

- **Per-user sessions** — Each WeChat user gets their own context
- **Token rotation** — At 60k tokens, generates background summary; at 80k, rotates to new session with summary injected
- **Idle cleanup** — Sessions expire after 30 minutes

The Claude CLI provider uses this. For API-based providers, you can either:

1. **Use the built-in session manager** — Import `server/ai/session-manager.ts` functions
2. **Manage sessions yourself** — Keep your own message history (like the OpenAI example above)

## Request Queue

The built-in `RequestQueue` (`server/ai/request-queue.ts`) provides:

- Concurrency limiting (default 6)
- Priority scheduling (chat > session > summary > task)
- 429 rate-limit auto-retry with backoff

Use it in your provider:

```typescript
import { globalQueue, withRetry, PRIORITY_SESSION } from "../request-queue.js";

const result = await globalQueue.enqueue(
  withRetry(() => callMyApi(prompt)),
  PRIORITY_SESSION,
);
```

## Testing Your Provider

1. Set the env variables
2. Start wxai: `npx wxai start`
3. Check health: `curl http://127.0.0.1:3800/api/health`
4. Send a test message from WeChat
5. Check logs for `[wxai] AI Provider: <your-name> (可用)`

## Provider Checklist

Before submitting a PR:

- [ ] Implements all 4 methods of `AiProvider`
- [ ] Respects `ModelTier` (maps to actual models)
- [ ] Handles `timeoutMs` (uses `AbortSignal.timeout`)
- [ ] Returns proper `AiResponse` with token counts
- [ ] `healthCheck()` returns `false` if API key is missing
- [ ] Handles errors gracefully (returns `isError: true`, not throwing)
- [ ] Registered in `provider-factory.ts`
- [ ] Documented env variables in `.env.example`
- [ ] No hardcoded API keys or secrets
