# wxai

> 本文档基于代码生成，最后更新：2026-04-04

**WeChat AI Bot** — 扫码登录微信，接入任意 AI 后端，让微信变成 AI 助手。

---

## 项目简介

wxai 是一个自托管的微信消息网关。通过 iLink Bot API 接收微信消息，转发给 AI Provider 处理后回复。无需微信公众号审批，使用个人微信号扫码即可接入。

核心特点：
- 零厂商锁定：切换 AI 只需改一个环境变量
- 单进程、无数据库：所有状态以 JSON 文件存储在 `~/.wxai/`
- 插件系统：支持关键词触发和定时任务
- Web 管理界面：React 19 + Tailwind CSS 4，含暗色模式

---

## 快速开始

```bash
# 1. 克隆并安装依赖
git clone <repo-url>
cd wxai
npm install
cd ui && npm install && cd ..

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，至少设置 WXAI_API_KEY

# 3. 构建 Web UI
npm run build

# 4. 扫码登录微信
npx wxai login

# 5. 启动服务
npx wxai start          # 前台运行
npx wxai start -d       # PM2 守护进程模式

# 6. 打开管理界面
open http://127.0.0.1:3800
```

---

## 环境变量

所有可配置项见 `.env.example`，关键变量：

| 变量 | 必填 | 说明 |
|------|------|------|
| `WXAI_API_KEY` | 是 | Web UI 认证密钥及 API Bearer Token |
| `WXAI_PASSWORD` | 否 | Web UI 登录密码，默认同 `WXAI_API_KEY` |
| `WXAI_PORT` | 否 | HTTP 服务端口，默认 `3800` |
| `WXAI_HOST` | 否 | 监听地址，默认 `127.0.0.1` |
| `WXAI_AI_PROVIDER` | 否 | AI Provider 类型，默认 `claude-cli` |
| `WXAI_MAX_CONCURRENT` | 否 | 最大并发 AI 请求数，默认 `6` |

---

## CLI 命令

```bash
wxai login        # 终端显示二维码，扫码登录微信
wxai accounts     # 列出所有已登录的微信账号
wxai start        # 启动服务（前台）
wxai start -d     # 启动服务（PM2 守护进程）
wxai stop         # 停止 PM2 进程
wxai status       # 查看 PM2 运行状态
```

---

## 微信指令

登录后，在微信中向 Bot 发送以下指令：

| 指令 | 说明 |
|------|------|
| `#帮助` / `#help` | 查看所有可用指令 |
| `#用量` | 查看本人 AI 用量统计 |
| `#清除` | 清除多轮对话上下文 |
| `#订阅 <插件名>` | 订阅插件推送 |
| `#退订 <插件名>` | 退订插件推送 |
| `#echo <文字>` | 内置 echo 插件（测试用） |
| 其他文字/图片 | 进入 AI 多轮对话 |

---

## Web 管理界面

服务启动后访问 `http://127.0.0.1:3800`（端口见配置），包含以下页面：

| 页面 | 功能 |
|------|------|
| Dashboard | 账号状态总览、在线/离线统计、AI 健康状态 |
| Users | 微信用户列表、权限管理（允许/封禁） |
| AI Config | 当前 Provider 状态和配置指引 |
| Plugins | 已注册插件、触发词、定时计划 |
| Send Test | 手动向指定用户发送测试消息 |
| QR Login | 扫码添加新的微信账号 |

---

## 项目结构

```
wxai/
├── bin/                        # CLI 入口
│   ├── wxai.ts                 # CLI 主程序（commander）
│   └── commands/               # login / accounts / service
├── server/                     # 后端服务
│   ├── index.ts                # 服务启动入口
│   ├── config.ts               # 配置加载与路径常量
│   ├── types.ts                # 全局类型定义
│   ├── ai/                     # AI 抽象层
│   │   ├── types.ts            # AiProvider 接口定义
│   │   ├── provider-factory.ts # Provider 工厂
│   │   ├── providers/          # Provider 实现（claude-cli 等）
│   │   ├── session-manager.ts  # 多轮会话 + Token 轮转
│   │   ├── request-queue.ts    # 优先级队列 + 429 重试
│   │   └── usage-tracker.ts    # 用量统计
│   ├── chatbot/                # 消息处理
│   │   ├── handler.ts          # 消息分发主逻辑
│   │   ├── command-parser.ts   # 指令解析
│   │   ├── chat-router.ts      # 模型路由（fast/balanced/powerful）
│   │   └── help.ts             # 帮助文本
│   ├── gateway/                # iLink Bot 接入层
│   │   ├── ilink-client.ts     # HTTP 客户端（无状态）
│   │   ├── poller.ts           # 消息轮询 + 防抖分发
│   │   ├── message-parser.ts   # 消息格式解析
│   │   └── keepalive.ts        # 连接保活
│   ├── plugins/                # 插件系统
│   │   ├── types.ts            # WxaiPlugin 接口
│   │   ├── loader.ts           # 插件注册与匹配
│   │   ├── scheduler.ts        # 定时任务调度
│   │   └── builtin/            # 内置插件（echo 等）
│   ├── store/                  # JSON 文件持久化
│   │   ├── json-file.ts        # 底层读写工具
│   │   ├── account-store.ts    # 账号数据
│   │   ├── user-store.ts       # 用户权限
│   │   └── context-store.ts    # context token 缓存
│   ├── routes/                 # Fastify HTTP 路由
│   │   ├── accounts.ts         # /api/accounts/*
│   │   ├── users.ts            # /api/manage/users/*
│   │   ├── send.ts             # /api/send
│   │   ├── plugins.ts          # /api/plugins
│   │   └── health.ts           # /api/health
│   └── middleware/             # 中间件
│       ├── auth.ts             # API Key + Session Cookie 认证
│       └── error-handler.ts    # 统一错误处理
├── ui/                         # React Web UI
│   └── src/
│       ├── pages/              # Dashboard / Users / AiConfig / Plugins / SendTest / QrLogin
│       ├── components/         # Layout / StatusBadge
│       ├── lib/                # api.ts（HTTP 客户端）/ types.ts
│       └── hooks/              # useDarkMode
├── examples/                   # 插件示例
├── docs/                       # 开发者文档
│   ├── ARCHITECTURE.md         # 系统架构详解
│   └── OPERATIONS.md           # 部署与运维手册
├── ecosystem.config.cjs        # PM2 配置
├── tsconfig.json               # TypeScript 配置
└── package.json
```

---

## 数据存储

所有运行时数据存储在 `~/.wxai/`：

```
~/.wxai/
├── config.json              # 运行时配置
├── accounts.json            # 微信 Bot 账号列表
├── users.json               # 用户权限与订阅
├── usage.json               # AI 用量统计
├── workspaces/              # Claude CLI 隔离工作目录（按 userId）
├── context-tokens/          # 各账号的 context token 缓存
│   ├── <prefix>.json
│   └── global.json
└── sync-bufs/               # 轮询游标（断点续传）
    └── <prefix>.txt
```

---

## 开发

```bash
# 后端热更新
npm run dev

# 前端 Vite 开发服务器
npm run dev:ui

# 运行测试
npm test

# 构建生产 UI
npm run build
```

详细架构说明见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。  
部署与运维手册见 [docs/OPERATIONS.md](docs/OPERATIONS.md)。

---

## License

[MIT](LICENSE)
