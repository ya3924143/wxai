<p align="center">
  <img src="ui/public/favicon.svg" width="80" height="80" alt="wxai logo" />
</p>

<h1 align="center">wxai</h1>

<p align="center">
  <strong>WeChat AI Bot</strong> — Connect your WeChat to any AI with one scan.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#ai-providers">AI Providers</a> &bull;
  <a href="docs/ai-providers.md">Provider Dev Guide</a> &bull;
  <a href="docs/plugin-development.md">Plugin Dev Guide</a> &bull;
  <a href="#web-ui">Web UI</a>
</p>

---

wxai is a **self-hosted** WeChat messaging gateway that bridges your WeChat account with any AI backend. Scan a QR code in your terminal, point it at Claude / GPT / DeepSeek / your local model, and your WeChat becomes an AI assistant.

## Why wxai?

- **Zero vendor lock-in** — Swap AI providers by changing one env variable
- **One-scan setup** — Terminal or Web UI QR code login, no WeChat API approval needed
- **Single process** — No microservices, no databases. One `npm start` and you're live
- **Extensible** — Plugin system with cron schedules, or build your own AI provider in ~100 lines

## Features

| Category | Details |
|----------|---------|
| **Gateway** | iLink Bot polling, 3s message debounce, auto keepalive |
| **AI** | Provider abstraction, session management, token rotation (60k/80k), background summarization, priority queue with 429 retry |
| **Chat** | Smart model routing (powerful/balanced/fast based on message content), multi-turn context, image support |
| **Plugins** | Keyword triggers + cron schedules, full AI access in plugin context |
| **Management** | Per-user permission control, usage tracking |
| **UI** | Web dashboard (React 19 + Tailwind CSS 4) with dark mode, CLI tool with terminal QR code |

## Quick Start

```bash
# 1. Clone
git clone https://github.com/ya3924143/wxai.git
cd wxai

# 2. Install
npm install
cd ui && npm install && cd ..

# 3. Configure
cp .env.example .env
# Edit .env → set WXAI_API_KEY to any secret string

# 4. Build Web UI
npm run build

# 5. Login via terminal QR code
npx wxai login

# 6. Start
npx wxai start          # foreground
npx wxai start -d       # PM2 daemon mode

# 7. Open Web UI
open http://127.0.0.1:3800
```

## Architecture

```
                         ┌──────────────────────────────────────┐
  WeChat Users           │            wxai (:3800)              │
       │                 │                                      │
       ▼                 │  ┌─────────┐    ┌──────────┐        │
  iLink Bot API ────────▶│  │ Gateway │───▶│ Chatbot  │        │
                         │  │ polling │    │ commands │        │
                         │  │ debounce│    │ plugins  │        │
                         │  │ keepalve│    │ routing  │        │
                         │  └─────────┘    └────┬─────┘        │
                         │                      │              │
                         │               ┌──────▼──────┐       │
                         │               │ AI Provider │       │
                         │               │ ┌─────────┐ │       │
                         │               │ │Claude CLI│ │       │
                         │               │ ├─────────┤ │       │
                         │               │ │Anthropic│ │       │
                         │               │ ├─────────┤ │       │
                         │               │ │ OpenAI  │ │       │
                         │               │ └─────────┘ │       │
                         │               └─────────────┘       │
                         │                                      │
                         │  ┌─────────┐    ┌──────────┐        │
                         │  │  Store  │    │  Web UI  │        │
                         │  │  JSON   │    │React+TW4 │        │
                         │  └─────────┘    └──────────┘        │
                         └──────────────────────────────────────┘
```

Single process. No database — all state in `~/.wxai/*.json`.

## AI Providers

wxai uses an **`AiProvider` interface** — implement 4 methods and your AI is in.

### Built-in: Claude CLI (default)

Uses your locally installed [Claude Code](https://claude.ai/claude-code) CLI. **No API key needed** — it piggybacks on your logged-in Claude account.

```env
WXAI_AI_PROVIDER=claude-cli
```

### Build Your Own Provider

See **[docs/ai-providers.md](docs/ai-providers.md)** for the full guide. Here's the minimal interface:

```typescript
interface AiProvider {
  readonly id: string;
  readonly name: string;
  chat(content: string, options?: ChatOptions): Promise<AiResponse>;
  sessionSend(userId: string, content: string, options?: SessionOptions): Promise<AiResponse>;
  clearSession(userId: string): Promise<void>;
  healthCheck(): Promise<boolean>;
}
```

Three model tiers: `"fast"` / `"balanced"` / `"powerful"` — map them to whatever models your backend offers.

### Planned Providers

| Provider | Env Config | Status |
|----------|-----------|--------|
| Claude CLI | `WXAI_AI_PROVIDER=claude-cli` | ✅ Built-in |
| Anthropic API | `WXAI_AI_PROVIDER=anthropic-api` | 🔜 Planned |
| OpenAI Compatible | `WXAI_AI_PROVIDER=openai-compat` | 🔜 Planned |

> Want to add a provider? See [docs/ai-providers.md](docs/ai-providers.md) — PRs welcome!

## Plugin System

Plugins extend wxai with custom commands and scheduled tasks.

```typescript
import type { WxaiPlugin } from "./server/plugins/types.js";

export const weatherPlugin: WxaiPlugin = {
  id: "weather",
  name: "Weather",
  description: "Check weather by city name",
  triggers: ["#weather", "#天气"],
  schedule: { cron: "0 8 * * *", label: "Daily morning weather" }, // optional

  async execute(ctx) {
    // ctx.ai — full AI provider access
    // ctx.reply(msg) — send WeChat message back
    // ctx.args — text after the trigger keyword
    const answer = await ctx.ai.chat(`What's the weather in ${ctx.args}?`);
    await ctx.reply(answer.text);
    return { handled: true };
  },
};
```

Register in `server/index.ts`:
```typescript
registerPlugin(weatherPlugin);
```

See **[docs/plugin-development.md](docs/plugin-development.md)** for the full guide.

## CLI

```bash
wxai login         # Terminal QR code scan
wxai accounts      # List WeChat accounts
wxai start         # Start server (foreground)
wxai start -d      # Start with PM2 daemon
wxai stop          # Stop PM2 process
wxai status        # Check PM2 status
```

## Web UI

6-page management dashboard at `http://127.0.0.1:3800`:

| Page | What it does |
|------|-------------|
| **Dashboard** | Account status cards, online/offline stats, AI health |
| **Users** | WeChat user list + permission management (allow/block) |
| **AI Config** | Current provider status, configuration guide |
| **Plugins** | Registered plugins, trigger keywords, schedules |
| **Send Test** | Pick a user and send test messages |
| **QR Login** | Scan QR code to add new WeChat accounts |

Full dark mode support. Mobile responsive.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WXAI_API_KEY` | **Yes** | — | Secret key for Web UI auth and API calls |
| `WXAI_PASSWORD` | No | same as API key | Separate Web UI password |
| `WXAI_PORT` | No | `3800` | HTTP server port |
| `WXAI_HOST` | No | `127.0.0.1` | HTTP server host |
| `WXAI_AI_PROVIDER` | No | `claude-cli` | AI provider type |
| `WXAI_MAX_CONCURRENT` | No | `6` | Max concurrent AI requests |

## Data Storage

All data lives in `~/.wxai/` as plain JSON files:

```
~/.wxai/
├── config.json              # Runtime config
├── accounts.json            # WeChat bot accounts
├── users.json               # User permissions & subscriptions
├── usage.json               # AI usage tracking
├── context-tokens/          # Per-account context tokens
│   ├── <prefix>.json
│   └── global.json
└── sync-bufs/               # Polling cursors
    └── <prefix>.txt
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js ESM + [Fastify 5](https://fastify.dev) + TypeScript + [Zod](https://zod.dev) |
| Frontend | [React 19](https://react.dev) + [Tailwind CSS 4](https://tailwindcss.com) + [Vite 8](https://vite.dev) |
| Data | JSON file persistence (no database) |
| Process | [PM2](https://pm2.keymetrics.io) |
| Test | [Vitest](https://vitest.dev) |

## Project Structure

```
wxai/
├── bin/                    # CLI tool (wxai login/start/stop)
├── server/
│   ├── ai/                 # AI provider abstraction
│   │   ├── types.ts        # AiProvider interface
│   │   ├── providers/      # Provider implementations
│   │   ├── session-manager # Multi-turn session with token rotation
│   │   └── request-queue   # Priority queue with 429 retry
│   ├── chatbot/            # Message handling & command parsing
│   ├── gateway/            # iLink polling, keepalive, message parser
│   ├── plugins/            # Plugin system (interface + loader + scheduler)
│   ├── store/              # JSON file persistence
│   ├── routes/             # Fastify HTTP API routes
│   └── middleware/         # Auth & error handling
├── ui/                     # React Web UI
│   └── src/pages/          # Dashboard, Users, AiConfig, Plugins, etc.
├── docs/                   # Developer documentation
└── examples/               # Example plugins
```

## Contributing

PRs welcome! The most impactful contributions right now:

1. **New AI providers** — Anthropic API, OpenAI, Ollama, etc. See [docs/ai-providers.md](docs/ai-providers.md)
2. **Plugins** — Useful plugins for the community
3. **Tests** — Unit and integration tests
4. **Docs** — Translations, tutorials

## License

[MIT](LICENSE)
