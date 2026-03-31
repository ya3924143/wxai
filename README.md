# wxai

**WeChat AI Bot** — Connect your WeChat to any AI with one scan.

wxai is a self-hosted WeChat gateway that bridges your WeChat account with AI providers. Scan a QR code, configure your AI backend, and start chatting.

## Features

- **One-Scan Setup** — QR code login in CLI or Web UI
- **AI Provider Abstraction** — Claude CLI (default), Anthropic API, OpenAI-compatible (extensible)
- **Smart Routing** — Auto-select model tier based on message content
- **Session Management** — Token rotation with background summarization
- **Plugin System** — Extensible plugins with trigger keywords and cron schedules
- **User Management** — Permission control per WeChat user
- **Web Dashboard** — Account status, user management, AI config, plugin overview
- **Message Debouncing** — 3s debounce merges rapid-fire messages
- **Dark Mode** — Full dark mode support in Web UI

## Quick Start

```bash
# Clone and install
git clone https://github.com/yourname/wxai.git
cd wxai
npm install && cd ui && npm install && cd ..

# Configure
cp .env.example .env
# Edit .env: set WXAI_API_KEY

# Login
npx wxai login          # Terminal QR code

# Start
npx wxai start          # Foreground
npx wxai start -d       # PM2 daemon

# Web UI
open http://127.0.0.1:3800
```

## Architecture

```
WeChat User <-> iLink Bot API <-> wxai (:3800)
                                    |
                   +----------------+----------------+
                   |                |                |
              Gateway Layer    Chatbot Layer    AI Provider
              - Polling        - Commands       - Claude CLI
              - Debounce       - Chat Router    - Session Mgmt
              - Keepalive      - Plugins        - Queue
```

Single-process, no database. All data stored as JSON files in `~/.wxai/`.

## CLI Commands

```bash
wxai login       # QR code login in terminal
wxai accounts    # List WeChat accounts
wxai start       # Start server (foreground)
wxai start -d    # Start with PM2
wxai stop        # Stop PM2 process
wxai status      # Check PM2 status
```

## Web UI Pages

| Page | Description |
|------|-------------|
| Dashboard | Account status overview |
| Users | Manage user permissions |
| AI Config | View AI provider status |
| Plugins | View registered plugins |
| Send Test | Test message sending |
| QR Login | Scan QR code to add accounts |

## AI Providers

### Claude CLI (Default)

Uses locally installed [Claude Code](https://claude.ai/claude-code) CLI. No API key needed — uses your logged-in Claude account.

```env
WXAI_AI_PROVIDER=claude-cli
```

### Anthropic API (Coming Soon)

```env
WXAI_AI_PROVIDER=anthropic-api
ANTHROPIC_API_KEY=sk-ant-xxx
```

### OpenAI Compatible (Coming Soon)

```env
WXAI_AI_PROVIDER=openai-compat
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
```

## Plugin Development

Create a plugin by implementing the `WxaiPlugin` interface:

```typescript
import type { WxaiPlugin } from "./server/plugins/types.js";

export const myPlugin: WxaiPlugin = {
  id: "my-plugin",
  name: "My Plugin",
  description: "Does something useful",
  triggers: ["#my", "#myplugin"],

  async execute(ctx) {
    const response = await ctx.ai.chat(ctx.args);
    await ctx.reply(response.text);
    return { handled: true };
  },
};
```

Register in `server/index.ts`:

```typescript
import { myPlugin } from "./plugins/my-plugin.js";
registerPlugin(myPlugin);
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WXAI_API_KEY` | Yes | API key for Web UI and external API calls |
| `WXAI_PASSWORD` | No | Web UI password (defaults to API key) |
| `WXAI_PORT` | No | HTTP port (default: 3800) |
| `WXAI_HOST` | No | HTTP host (default: 127.0.0.1) |
| `WXAI_AI_PROVIDER` | No | AI provider type (default: claude-cli) |
| `WXAI_MAX_CONCURRENT` | No | Max concurrent AI requests (default: 6) |

## Tech Stack

- **Backend**: Node.js ESM + Fastify 5 + TypeScript + Zod
- **Frontend**: React 19 + Tailwind CSS 4 + Vite 8
- **Data**: JSON file persistence (no database)
- **Process**: PM2
- **Test**: Vitest

## License

MIT
