# wxai 运维手册

> 本文档基于代码生成，最后更新：2026-04-04

---

## 环境要求

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | ≥ 20 | ESM 模块支持 |
| npm | ≥ 10 | 工作区管理 |
| Claude Code CLI | 最新版 | 使用 `claude-cli` Provider 时必须 |
| PM2 | 全局安装 | 守护进程模式时使用 |

---

## 首次部署

### 1. 安装依赖

```bash
npm install
cd ui && npm install && cd ..
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，必须设置 `WXAI_API_KEY`（Web UI 认证密钥）。其余变量见 [README.md](../README.md#环境变量)。

### 3. 构建 Web UI

```bash
npm run build
```

构建产物输出到 `ui/dist/`，由 Fastify 作为静态文件提供服务。**每次修改前端代码后需重新构建。**

### 4. 登录微信账号

```bash
npx wxai login
```

终端将显示二维码，使用微信扫码。扫码成功后 Bot Token 自动保存到 `~/.wxai/accounts.json`。

也可在服务启动后通过 Web UI 的 QR Login 页面添加账号。

### 5. 启动服务

**前台运行（调试用）：**
```bash
npx wxai start
```

**PM2 守护进程（生产推荐）：**
```bash
npx wxai start -d
```

PM2 配置文件为 `ecosystem.config.cjs`，内存上限 300M，日志输出到 `/dev/null`（通过 PM2 日志管理）。

---

## 日常运维

### 查看运行状态

```bash
wxai status         # PM2 进程状态
pm2 logs wxai       # 实时日志
pm2 monit           # PM2 监控面板
```

### 停止 / 重启

```bash
wxai stop           # 停止
pm2 restart wxai    # 重启
pm2 reload wxai     # 无中断重载（ESM 模式下等同于 restart）
```

### 查看账号列表

```bash
wxai accounts
```

---

## 账号管理

### 添加账号

两种方式均可：

1. CLI：`wxai login`（终端二维码）
2. Web UI：访问 QR Login 页面

### 账号状态

账号有三种状态，保存在 `~/.wxai/accounts.json`：

| 状态 | 说明 |
|------|------|
| `online` | 正常在线，轮询运行中 |
| `offline` | 连续失败超过阈值（默认 5 次），停止轮询 |
| `expired` | 手动标记或 Token 过期，不参与轮询 |

账号变为 `offline` 后需重新扫码登录以恢复。

### 保活配置

保活间隔和最大失败次数在 `~/.wxai/config.json` 中配置：

```json
{
  "keepAliveIntervalMs": 300000,
  "keepAliveMaxFailures": 5
}
```

可在 Web UI Dashboard 中为特定账号开启 `keepaliveExclude`（不参与保活轮询）。

---

## 用户权限管理

新用户默认无权限。通过 Web UI 的 Users 页面或直接编辑 `~/.wxai/users.json` 开放权限。

**通过 API 添加用户：**

```bash
curl -X POST http://127.0.0.1:3800/api/manage/users \
  -H "Authorization: Bearer <WXAI_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"userId": "<wechat_user_id>", "name": "用户名", "chat": true}'
```

**修改权限：**

```bash
curl -X PUT http://127.0.0.1:3800/api/manage/users/<userId>/permissions \
  -H "Authorization: Bearer <WXAI_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"chat": false}'
```

---

## AI Provider 配置

当前内置 Provider 仅有 `claude-cli`（通过 `WXAI_AI_PROVIDER` 环境变量选择）。

**claude-cli 前提条件：**
- 本机已安装 Claude Code CLI（`claude` 命令可用）
- 已通过 `claude auth login` 完成登录
- 验证：`claude --version`

**调整并发数：**

修改 `.env` 中的 `WXAI_MAX_CONCURRENT`（默认 6），控制同时运行的 AI 请求数量。设置过高可能触发 Claude 的速率限制。

---

## 数据目录

所有运行时数据存储在 `~/.wxai/`（路径不可配置）：

```
~/.wxai/
├── config.json              # 运行时配置（端口、保活参数等）
├── accounts.json            # Bot 账号列表
├── users.json               # 用户权限和订阅
├── usage.json               # AI 用量统计
├── workspaces/              # Claude CLI 隔离工作目录
├── context-tokens/          # iLink context_token 缓存
└── sync-bufs/               # 消息轮询断点游标
```

### 备份建议

对以下文件定期备份：
- `accounts.json` — 账号 token，重要，丢失需重新扫码
- `users.json` — 用户权限配置
- `usage.json` — 用量记录（非关键）

`workspaces/` 和 `context-tokens/` 丢失后会自动重建（功能不受影响）。

### 清理旧数据

```bash
# 清理 Claude CLI 工作目录（安全，不影响运行）
rm -rf ~/.wxai/workspaces/

# 清理游标（会重新拉取历史消息，谨慎操作）
rm -rf ~/.wxai/sync-bufs/
```

---

## 健康检查

```bash
# HTTP 健康端点（无需认证）
curl http://127.0.0.1:3800/api/health
# 响应: {"success":true,"data":{"status":"ok","uptime":1234.56}}
```

可将此端点加入监控系统（Prometheus、Uptime Robot 等）。

---

## 故障排查

### Bot 不回复消息

1. 检查服务是否运行：`wxai status`
2. 检查账号状态：`wxai accounts` 或 Web UI Dashboard
3. 检查用户是否有权限：Web UI Users 页面
4. 查看实时日志：`pm2 logs wxai`

### 账号变为 offline

- 原因：连续 getupdates 失败超过阈值（默认 5 次）
- 解决：重新扫码登录 `wxai login` 或通过 Web UI QR Login

### Claude CLI 不可用

- 检查：`claude --version`
- 如果命令不存在：安装 Claude Code CLI
- 如果未登录：`claude auth login`
- Web UI 的 AI Config 页面会显示 Provider 健康状态

### AI 响应慢或 429 错误

- 降低 `WXAI_MAX_CONCURRENT`（减少并发）
- 系统会自动重试（最多 3 次，指数退避）
- 查看日志中的 `rate limit` 信息

### Web UI 无法访问

- 确认服务已启动：`wxai status`
- 确认访问地址与 `WXAI_HOST`/`WXAI_PORT` 配置一致
- 默认地址：`http://127.0.0.1:3800`
- 检查防火墙/端口是否开放

### 忘记 API Key

- 查看 `.env` 文件中的 `WXAI_API_KEY`
- 修改后需重启服务生效

---

## 升级

```bash
git pull
npm install
cd ui && npm install && cd ..
npm run build
pm2 restart wxai
```

---

## 日志管理

PM2 默认将日志输出到 `/dev/null`（见 `ecosystem.config.cjs`）。如需持久化日志：

```bash
# 修改 ecosystem.config.cjs，设置日志文件路径
error_file: '~/.wxai/logs/error.log',
out_file: '~/.wxai/logs/out.log',
```

或使用 pm2-logrotate 插件：

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 安全建议

- `WXAI_API_KEY` 设置为足够长的随机字符串（建议 32 位以上）
- 不要将服务暴露到公网，默认监听 `127.0.0.1`
- 如需远程访问，在前面加 Nginx 反向代理 + HTTPS
- 定期轮换 `WXAI_API_KEY`

---

## API 调用示例

所有 API 请求需携带认证头：

```bash
# 向用户主动发送消息
curl -X POST http://127.0.0.1:3800/api/send \
  -H "Authorization: Bearer <WXAI_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"userId": "<wechat_user_id>", "text": "Hello!"}'

# 列出所有账号
curl http://127.0.0.1:3800/api/accounts \
  -H "Authorization: Bearer <WXAI_API_KEY>"

# 列出已注册插件
curl http://127.0.0.1:3800/api/plugins \
  -H "Authorization: Bearer <WXAI_API_KEY>"
```
