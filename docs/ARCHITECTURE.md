# wxai 系统架构

> 本文档基于代码生成，最后更新：2026-04-04

---

## 总体架构

wxai 是一个单进程服务，由以下四个核心层构成：

```
微信用户
   │
   ▼
iLink Bot API（长轮询）
   │
   ▼
┌─────────────────────────────────────────────────┐
│                   wxai 进程                      │
│                                                 │
│  Gateway 层        Chatbot 层      AI 层         │
│  ┌──────────┐  →  ┌──────────┐  → ┌──────────┐ │
│  │ poller   │     │ handler  │    │ provider │ │
│  │ keepalive│     │ cmd-parse│    │ session  │ │
│  │ ilink-   │     │ chat-    │    │ request- │ │
│  │ client   │     │ router   │    │ queue    │ │
│  └──────────┘     └──────────┘    └──────────┘ │
│                                                 │
│  Store 层（JSON 文件）    HTTP 层（Fastify）      │
│  ┌──────────────────┐   ┌──────────────────┐   │
│  │ account-store    │   │ /api/accounts    │   │
│  │ user-store       │   │ /api/manage/users│   │
│  │ context-store    │   │ /api/send        │   │
│  └──────────────────┘   │ /api/plugins     │   │
│                         │ /api/health      │   │
│                         └──────────────────┘   │
│                                                 │
│  Web UI（React，静态文件服务）                    │
└─────────────────────────────────────────────────┘
```

---

## 各层职责

### Gateway 层（`server/gateway/`）

负责与 iLink Bot API 的所有交互，设计为无状态纯函数集合。

**`ilink-client.ts`**：HTTP 客户端，封装所有对 iLink API 的调用：
- `getQrCode()` — 获取扫码登录二维码
- `pollQrStatus()` — 轮询扫码结果，成功后返回 token
- `getUpdates()` — 长轮询拉取新消息（40s 超时）
- `sendWechatMessage()` — 向指定用户发送文本消息

**`poller.ts`**：消息轮询管理器：
- 每个在线账号独立开启一条轮询循环（`AbortController` 控制生命周期）
- 每 60 秒重新扫描账号列表，自动增删轮询实例
- 接收到消息后，按 `userId` 维度进行 **3 秒防抖**，合并快速连续消息后统一投递
- 收到消息时同步更新 `context_token` 缓存

**`keepalive.ts`**：连接保活：
- 对每个账号按固定间隔（见配置）执行 `getupdates`，维持 iLink 连接
- 连续失败超过阈值后将账号标记为 `offline`
- 与 poller 并行运行，各自独立

**`message-parser.ts`**：将 iLink 原始消息格式解析为内部 `ParsedMessage` 类型（支持文本、语音转写、图片下载）。

---

### Chatbot 层（`server/chatbot/`）

消息从 poller 直接函数调用，不经过 HTTP webhook。

**`handler.ts`**：消息分发主逻辑（`createMessageHandler`）：
1. 权限检查（`canChat(userId)`），帮助指令豁免
2. 解析指令类型
3. 根据类型分发：内置指令 → 直接处理；插件指令 → 调插件；普通消息 → 调 AI
4. 长消息自动分段发送（1800 字/段）

**`command-parser.ts`**：将文本解析为指令类型：
- `help`、`usage`、`clear`、`subscribe`、`unsubscribe`、`plugin`、`chat`

**`chat-router.ts`**：根据消息内容决定使用哪个模型等级（`ModelTier`）和最大轮次：
- 追问/要求详细 → `powerful`（8 轮）
- 分析、代码、搜索等复杂任务 → `powerful`（5 轮）
- 普通对话 → `balanced`（3 轮）

---

### AI 层（`server/ai/`）

**`types.ts`**：`AiProvider` 接口定义（Provider 契约）：

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

模型等级（`ModelTier`）：`"fast"` / `"balanced"` / `"powerful"`，各 Provider 内部自行映射到具体模型。

**`provider-factory.ts`**：根据 `WXAI_AI_PROVIDER` 环境变量创建对应 Provider 实例。

**`providers/claude-cli.ts`**：目前唯一内置 Provider，通过 `execFile("claude", ["-p", prompt, ...])` 调用本机 Claude Code CLI：
- 模型映射：`fast` → `claude-haiku-4-5`，`balanced` → `claude-sonnet-4-6`，`powerful` → `claude-opus-4-6`
- 每个用户有独立的隔离工作目录（`~/.wxai/workspaces/<userId>/`）
- 图片通过临时文件传递，响应后自动清理
- 使用 `--resume <session_id>` 保持多轮上下文

**`session-manager.ts`**：Provider 无关的 Session 生命周期管理：
- Token 预警（60k tokens）时后台异步生成对话摘要
- Token 超限（80k tokens）时强制轮转，将摘要注入新 session 的 system prompt
- 空闲 30 分钟自动清理 session

**`request-queue.ts`**：优先级请求队列 + 429 自动重试：
- 最大并发数由 `WXAI_MAX_CONCURRENT` 控制
- 优先级：`chat(1)` > `session(2)` > `summary(5)` > `task(10)`（数值越小优先级越高）
- 429 限速错误时指数退避重试（最多 3 次，间隔 5s/10s/15s）

---

### Store 层（`server/store/`）

所有数据以 JSON 文件持久化到 `~/.wxai/`，读写操作全部采用不可变模式（读取 → 新对象 → 写回）。

| 文件 | Store 模块 | 说明 |
|------|-----------|------|
| `accounts.json` | `account-store.ts` | Bot 账号列表（token、baseUrl、status 等） |
| `users.json` | `user-store.ts` | 用户权限（chat 开关）、插件订阅关系 |
| `context-tokens/<prefix>.json` | `context-store.ts` | 各账号下各用户的 iLink context_token |
| `usage.json` | `usage-tracker.ts` | AI 用量记录（token 数、费用、模型） |
| `sync-bufs/<prefix>.txt` | 由 poller/keepalive 直接读写 | 消息轮询游标（断点续传） |

---

### 插件系统（`server/plugins/`）

**`types.ts`**：`WxaiPlugin` 接口：

```typescript
interface WxaiPlugin {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly triggers: readonly string[];       // 触发关键词列表
  readonly schedule?: ScheduleConfig;         // 可选定时计划
  execute(ctx: PluginContext): Promise<PluginResult>;
}
```

`PluginContext` 提供：`userId`、`rawText`、`args`（触发词后的文本）、`reply()`、`ai`（完整 Provider 访问）、`config`。

**`loader.ts`**：`registerPlugin()` 注册插件，`matchPlugin()` 按触发词匹配，`executePlugin()` 执行并捕获异常。

**`scheduler.ts`**：使用 `node-cron` 驱动定时计划，向所有订阅该插件的用户广播消息。

---

### HTTP API 层（`server/routes/`）

所有路由使用统一响应格式 `{ success: boolean, data?: T, error?: string }`。

认证机制（`server/middleware/auth.ts`）：
- `/api/health` 和 `/api/web/login` 无需认证
- 其余 `/api/*` 路由需要以下之一：
  - `Authorization: Bearer <WXAI_API_KEY>` 请求头
  - 有效的 `wg_session` Cookie（通过 `/api/web/login` 获取，TTL 24 小时）

主要端点：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/accounts` | 列出所有 Bot 账号 |
| POST | `/api/accounts/qr/start` | 获取扫码登录二维码 |
| GET | `/api/accounts/qr/status?qrcode=` | 轮询扫码结果 |
| DELETE | `/api/accounts/:token` | 删除账号 |
| PUT | `/api/accounts/:token/keepalive-exclude` | 设置保活豁免 |
| GET | `/api/manage/users` | 列出用户 |
| POST | `/api/manage/users` | 添加用户 |
| PUT | `/api/manage/users/:userId/permissions` | 修改用户权限 |
| DELETE | `/api/manage/users/:userId` | 删除用户 |
| POST | `/api/send` | 主动向用户发送消息 |
| GET | `/api/plugins` | 列出已注册插件 |
| GET | `/api/health` | 服务健康检查 |
| POST | `/api/web/login` | Web UI 密码登录 |

---

### Web UI（`ui/`）

React 19 + Tailwind CSS 4 + Vite，构建产物由 Fastify 静态文件服务托管（`ui/dist/`）。

所有 API 调用封装在 `ui/src/lib/api.ts`，使用 `Authorization: Bearer` 请求头认证。

路由（前端 SPA）：
- `/` — Dashboard
- `/users` — 用户管理
- `/ai-config` — AI 配置
- `/plugins` — 插件列表
- `/send-test` — 发送测试
- `/qr-login` — 扫码登录

---

## 扩展 AI Provider

实现 `AiProvider` 接口，注册到 `provider-factory.ts`，通过 `WXAI_AI_PROVIDER` 环境变量激活：

```typescript
// server/ai/providers/my-provider.ts
import type { AiProvider } from "../types.js";

export function createMyProvider(): AiProvider {
  return {
    id: "my-provider",
    name: "My AI",
    async chat(content, options) { /* ... */ },
    async sessionSend(userId, content, options) { /* ... */ },
    async clearSession(userId) { /* ... */ },
    async healthCheck() { /* ... */ },
  };
}
```

---

## 扩展插件

```typescript
// server/plugins/my-plugin.ts
import type { WxaiPlugin } from "./types.js";

export const myPlugin: WxaiPlugin = {
  id: "my-plugin",
  name: "My Plugin",
  description: "插件描述",
  triggers: ["#触发词"],
  schedule: { cron: "0 9 * * 1-5", label: "工作日早 9 点推送" }, // 可选

  async execute(ctx) {
    const result = await ctx.ai.chat(ctx.args);
    await ctx.reply(result.text);
    return { handled: true };
  },
};
```

在 `server/index.ts` 中调用 `registerPlugin(myPlugin)` 注册。

---

## 关键设计决策

| 决策 | 原因 |
|------|------|
| 单进程，无数据库 | 降低部署复杂度，个人用途下 JSON 文件足够 |
| 消息直接函数调用（非 webhook） | 减少 HTTP 开销，简化部署 |
| 按 userId 防抖 3 秒 | 合并快速连续消息，减少 AI 调用次数 |
| Token 轮转而非截断 | 保留长期对话连续性，通过摘要压缩历史 |
| 优先级队列 | 避免后台摘要任务阻塞用户实时消息 |
| 不可变 Store 更新 | 防止并发写入导致数据损坏 |
