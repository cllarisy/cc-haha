---
title: 本地 Server 与 API
nav_title: 本地 Server
description: 本地 Server 的启动参数、访问控制、REST 与 WebSocket 接口范围。
order: 2
---

# 本地 Server 与 API

本地 Server 是桌面端、H5 页面和 Claude CLI 之间的运行时边界。它提供 REST API、聊天 WebSocket、Provider 协议代理和桌面 Web 静态资源。打包后的桌面应用会自动管理它；只有源码开发、无界面部署或自定义客户端才需要手工启动。

## 启动

在仓库根目录运行：

```bash
bun run src/server/index.ts
```

默认监听 `127.0.0.1:3456`。确认服务就绪：

```bash
curl http://127.0.0.1:3456/health
```

返回格式：

```json
{
  "status": "ok",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

`/health` 是启动探针，始终公开，不代表其他接口已通过认证。

## 启动参数

| 参数 | 环境变量 | 默认值 | 说明 |
|------|----------|--------|------|
| `--host <host>` | `SERVER_HOST` | `127.0.0.1` | 监听地址 |
| `--port <port>` | `SERVER_PORT` | `3456` | HTTP 和 WebSocket 端口 |
| `--cli-path <path>` | `CLAUDE_CLI_PATH` | 自动解析 | 指定 Server 拉起的 CLI |
| `--auth-required` | `SERVER_AUTH_REQUIRED=1` | 关闭 | 对能力接口强制显式鉴权 |

命令行的 host 和 port 优先于环境变量。开发时建议保留回环地址；`0.0.0.0` 只表示接受外部连接，并不会自动完成 H5 授权、TLS 或反向代理配置。

## 提供 H5 页面

仓库把浏览器发行模式称为 Web；它与 Electron renderer 共用同一套 React 源码，但生成独立的 `desktop/web-dist` 静态产物，由 Bun 在同一 Origin 发布页面、REST 和 WebSocket：

```bash
# 开发（Bun + Vite，默认只监听 127.0.0.1）
bun run web:dev

# 生产构建与启动
bun run web:build
bun run web:start
```

Desktop 对应命令为 `bun run desktop:dev`、`bun run desktop:build` 和 `bun run desktop:package`。Web 产物不进入 Electron 安装包，Electron 仍使用 `desktop/dist`。

源码运行时先构建桌面 Web 资源：

```bash
cd desktop
bun run build
cd ..
bun run src/server/index.ts
```

Server 会自动查找仓库的 `desktop/dist`。从其他目录启动时，用绝对路径指定构建产物：

```bash
CLAUDE_H5_DIST_DIR=/absolute/path/to/desktop/dist \
  bun run /absolute/path/to/src/server/index.ts
```

| 变量 | 说明 |
|------|------|
| `CLAUDE_H5_DIST_DIR` | H5 构建产物目录，目录内必须有 `index.html` |
| `CLAUDE_H5_PUBLIC_BASE_URL` | 固定的公开服务地址 |
| `CLAUDE_H5_AUTO_PUBLIC_URL=1` | 在启用 H5 时尝试生成局域网公开地址 |
| `CLAUDE_H5_TOKEN` | 无 Desktop 的 Web 部署专用访问令牌；16–512 个可见 ASCII 字符，不写入前端 bundle |
| `CLAUDE_H5_ALLOWED_ORIGINS` | Web 部署允许的精确 Origin，逗号分隔，禁止通配符 |

完整的 Token、允许来源、手机访问和 Nginx 配置见 [H5 访问](../desktop/remote.md)。

本机部署无需令牌。要从局域网或反向代理公开，必须显式设置监听地址、独立令牌和精确 Origin，例如：

```bash
SERVER_HOST=0.0.0.0 \
CLAUDE_H5_TOKEN='请替换为至少16字符的随机令牌' \
CLAUDE_H5_ALLOWED_ORIGINS='https://cc.example.com' \
bun run web:start
```

浏览器首次连接时在连接页输入该令牌。不要把令牌写入 `VITE_*` 变量、URL、前端文件或普通日志。局域网明文 HTTP 只适合受信任网络；经公网或反向代理时必须使用 HTTPS，并代理 `/api`、`/proxy`、`/ws` 和静态资源。

Web 会完整移除只能作用于服务端机器的入口：内嵌 PTY、原生目录选择、IDE/文件管理器、自动更新/重启、桌面宠物、Electron 预览 WebView、Computer Use、本机 Adapter 生命周期和 H5 管理控制面。剪贴板、外部链接、文件上传、通知和缩放使用浏览器标准能力；会话、消息、权限、工作区/Diff、Provider、Agent、Skill、Plugin、MCP、任务、Trace、Memory、诊断和统计继续走共享 REST/WebSocket 实现。

## 访问控制

Server 根据请求来源和能力路径决定是否允许访问：

| 请求 | 默认行为 |
|------|----------|
| `GET /health` | 公开，用于启动探针 |
| H5 静态页面和 assets | 公开的启动外壳；页面本身不包含会话数据 |
| 直接回环请求 | 仅当客户端地址、Host 和 Origin 都是本机，且没有反向代理跟踪头时视为本机可信 |
| H5 关闭时的远程能力请求 | 拒绝 `/api`、`/proxy`、`/ws` 和文件能力 |
| H5 开启时的远程能力请求 | 要求有效 H5 Token，并校验浏览器 Origin |
| `--auth-required` / `SERVER_AUTH_REQUIRED=1` | 即使 H5 未开启，也对能力接口要求显式认证 |

“连接来自 `127.0.0.1`”本身不足以证明是本机用户。反向代理必须保留公开 `Host`，或传递 `Forwarded`、`X-Forwarded-*`、`X-Real-IP`、`Via` 中至少一种，让 Server 能区分反代流量和直接回环流量。

### Token 传递

- REST、协议代理和文件接口：`Authorization: Bearer <token>`
- 浏览器 WebSocket：`/ws/<session-id>?token=<token>`

H5 模式使用设置页生成的 H5 Token。显式 `--auth-required` 模式也能接受与服务端 `ANTHROPIC_API_KEY` 相同的 Bearer Token，但不建议为了远程访问暴露模型密钥；优先启用 H5 并使用独立 Token。

CORS 只限制浏览器读取响应，不是身份认证。非浏览器客户端不会因为 CORS 而安全。

## HTTP 接口范围

业务 REST API 位于 `/api/*`，主要覆盖：

- 会话、对话、搜索和文件系统；
- 设置、权限、模型、effort 和 Providers；
- Agents、任务、团队和计划任务；
- Skills、插件、市场和 MCP；
- IM 适配器和 Computer Use；
- 诊断、Doctor、活动统计、记忆和 traces；
- H5 访问控制。

具体请求与响应以 `src/server/api/` 的当前处理器为准。内部 `/sdk/<session-id>` WebSocket 是 Server 为自己拉起的 Claude CLI 使用的通道，不是第三方客户端 API。

`/proxy/*` 是 Provider 的协议转换入口，包含运行时认证和模型路由状态。不要把它当成通用的、无状态 OpenAI 代理公开出去。

## 聊天 WebSocket

客户端连接：

```text
ws://127.0.0.1:3456/ws/<session-id>
```

常用客户端消息包括：

- `user_message`、`stop_generation`
- `permission_response`、`computer_use_permission_response`
- `set_permission_mode`、`set_runtime_config`
- `sync_state`、`prewarm_session`
- `ping`

服务端会发送连接与会话状态、文本增量、思考、工具调用与结果、权限请求、重试/降级状态、错误、任务/团队更新和 `pong`。完整字段以 `src/server/ws/events.ts` 为准。

桌面客户端每 30 秒发送一次 ping；等待 pong 10 秒后会主动重连。重连退避上限为 30 秒，并不会在固定次数后永久停止。自定义客户端应能重复连接、重新同步状态，并忽略未知的新增消息字段。

## 反向代理清单

远程使用时至少完成：

1. 在 Server 端启用 H5，生成独立 Token，并配置精确的允许来源。
2. 使用 HTTPS，不在公开网络传输明文 Token。
3. 转发静态页面、`/api/*`、`/proxy/*` 和 `/ws/*`。
4. 为 `/ws/*` 开启 WebSocket upgrade。
5. 保留公开 Host 和标准代理头。
6. 不向公网转发内部 `/sdk/*`。

## 排查

| 现象 | 检查 |
|------|------|
| 端口无法监听 | `SERVER_PORT` 是否被占用；是否传入了有效数字 |
| `/health` 正常但 API 为 `403` | 请求被判定为远程，而 H5 尚未启用 |
| API 或 WebSocket 为 `401` | H5 Token 过期、缺失，或 WebSocket 没有 query token |
| 浏览器提示 CORS | 当前页面的精确 Origin 是否在 H5 允许列表 |
| WebSocket 反复重连 | 代理是否支持 upgrade、Token 是否传入、空闲连接是否被代理关闭 |
| 页面 `404` | 尚未构建 `desktop/dist`，或 `CLAUDE_H5_DIST_DIR` 指向错误 |
| 远程请求被当成本机 | 反向代理是否删除了公开 Host 和全部代理跟踪头 |
