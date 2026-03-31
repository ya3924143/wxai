# Plugin Development Guide

Plugins extend wxai with custom commands, automated tasks, and integrations.

## Plugin Interface

```typescript
interface WxaiPlugin {
  /** Unique identifier */
  readonly id: string;
  /** Display name */
  readonly name: string;
  /** Short description */
  readonly description: string;
  /** Trigger keywords (e.g. ["#weather", "#天气"]) */
  readonly triggers: readonly string[];
  /** Optional: cron schedule for automated execution */
  readonly schedule?: { cron: string; label: string };
  /** Plugin logic */
  execute(ctx: PluginContext): Promise<PluginResult>;
}
```

## Plugin Context

Your `execute` function receives a context object with everything you need:

```typescript
interface PluginContext {
  /** WeChat user ID who triggered the plugin */
  readonly userId: string;
  /** Full raw message text (e.g. "#weather Beijing") */
  readonly rawText: string;
  /** Text after the trigger keyword (e.g. "Beijing") */
  readonly args: string;
  /** Send a WeChat message back to the user */
  readonly reply: (msg: string) => Promise<void>;
  /** Full AI provider — call AI within your plugin */
  readonly ai: AiProvider;
  /** App configuration */
  readonly config: WxaiConfig;
}
```

## Quick Example: Translation Plugin

```typescript
// server/plugins/builtin/translate.ts

import type { WxaiPlugin, PluginContext, PluginResult } from "../types.js";

export const translatePlugin: WxaiPlugin = {
  id: "translate",
  name: "Translation",
  description: "Translate text to English",
  triggers: ["#translate", "#翻译"],

  async execute(ctx: PluginContext): Promise<PluginResult> {
    if (!ctx.args.trim()) {
      await ctx.reply("Usage: #translate <text to translate>");
      return { handled: true };
    }

    const response = await ctx.ai.chat(
      `Translate the following text to English. Only output the translation, nothing else:\n\n${ctx.args}`,
      { modelTier: "fast" },
    );

    await ctx.reply(response.text);
    return { handled: true };
  },
};
```

## Scheduled Plugin Example

Plugins can run on a cron schedule:

```typescript
export const dailyTipPlugin: WxaiPlugin = {
  id: "daily-tip",
  name: "Daily Tip",
  description: "Send a daily productivity tip",
  triggers: ["#tip"],
  schedule: {
    cron: "0 9 * * *",    // 9:00 AM every day
    label: "Morning tip",
  },

  async execute(ctx) {
    const tip = await ctx.ai.chat(
      "Give me a short, actionable productivity tip for today. Keep it under 100 words.",
      { modelTier: "fast" },
    );
    await ctx.reply(`Daily Tip:\n\n${tip.text}`);
    return { handled: true };
  },
};
```

## Registration

Register your plugin in `server/index.ts`:

```typescript
import { registerPlugin } from "./plugins/loader.js";
import { translatePlugin } from "./plugins/builtin/translate.js";
import { dailyTipPlugin } from "./plugins/builtin/daily-tip.js";

// In main():
registerPlugin(translatePlugin);
registerPlugin(dailyTipPlugin);
```

## Plugin Best Practices

1. **Keep it focused** — One plugin, one purpose
2. **Handle empty args** — Show usage when `ctx.args` is empty
3. **Use `modelTier: "fast"`** for simple tasks to save costs
4. **Return `{ handled: true }`** so wxai knows the message was processed
5. **Error handling** — Catch errors and reply with a user-friendly message:

```typescript
async execute(ctx) {
  try {
    // ... your logic
    return { handled: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await ctx.reply(`Plugin error: ${msg}`);
    return { handled: true, error: msg };
  }
}
```

## File Structure

```
server/plugins/
├── types.ts           # WxaiPlugin interface (don't modify)
├── loader.ts          # Registration & matching (don't modify)
├── scheduler.ts       # Cron scheduling (don't modify)
└── builtin/           # Put your plugins here
    ├── echo.ts        # Built-in example
    ├── translate.ts   # Your new plugin
    └── ...
```

## API Reference

### `ctx.reply(message: string)`

Send a WeChat message back to the user. Automatically handles:
- Long message splitting (>1800 chars)
- Account selection and context token lookup

### `ctx.ai`

Full `AiProvider` instance. Available methods:

```typescript
// Single-turn (no context)
const res = await ctx.ai.chat("Hello", { modelTier: "fast" });

// Multi-turn (with context per userId)
const res = await ctx.ai.sessionSend(ctx.userId, "Follow up question");

// Clear user's session
await ctx.ai.clearSession(ctx.userId);
```

### `ctx.args`

The text after the trigger keyword. Examples:

| Message | Trigger | `ctx.args` |
|---------|---------|-----------|
| `#weather Beijing` | `#weather` | `"Beijing"` |
| `#翻译 你好世界` | `#翻译` | `"你好世界"` |
| `#echo` | `#echo` | `""` |
