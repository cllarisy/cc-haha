# 项目开发上下文

本文件是后续 Codex 会话的项目状态入口。开始开发时先阅读本文件，再以当前代码、测试和 `git status --short` 核实内容；代码与本文不一致时以代码为准，并在结束时修正文档。

## 项目当前目标

cc-haha 当前同时支持两种发行和运行模式：

- Desktop：保留 Electron main、preload、renderer、sidecar 和全部原生宿主能力。
- Web：在浏览器中运行同一套 React/Vite 前端，由 Bun 同源提供静态资源、REST 和 WebSocket，可独立开发、构建和部署。
- 公共逻辑：页面、组件、store、API client、WebSocket client、样式和业务模型不复制；运行时以统一 host capability 决定入口是否存在。

当前工作的重点是维持 Desktop 无回退，同时让远程 Web 默认无法操作服务端机器上的原生高权限能力。

## 当前架构与运行模式

### 共享前端

`desktop/src` 是 Desktop 与 Web 唯一的业务前端源码。`desktop/vite.config.ts` 通过 `CC_HAHA_BUILD_TARGET=web`选择构建产物：

- Desktop：`desktop/dist`，`base: './'`，供 Electron renderer 使用。
- Web：`desktop/web-dist`，`base: '/'`，供 Bun 静态服务器使用。

不要新建第二套 Web 页面，也不要在业务组件中直接读取 `window.desktopHost`。宿主差异集中在 `desktop/src/lib/desktopHost`，组件只读取 `desktopHost.capabilities`。

### Bun Web 服务

`src/server/index.ts` 同源提供 Web 静态资源、REST、WebSocket 和 SPA fallback。默认监听 `127.0.0.1`；非 loopback 部署必须显式配置 H5 token 和精确 allowed origins。

远程请求先经过鉴权/CORS，再由 `src/server/webAccessPolicy.ts` 拒绝本机高权限 REST 能力。WebSocket 使用 `clientKind: 'h5'`，不能接收或批准 Computer Use 请求。前端 capability 负责交互和入口，服务端策略负责安全边界，两者不能相互替代。

### Desktop

Electron main/preload、pet/preview preload、sidecar、原生 Terminal、WebContentsView、更新、宠物和本机 shell 能力保持原路径。Desktop renderer 与 Web renderer 共用组件，但 Electron host 声明完整原生 capability。

## 关键目录和文件

- `package.json`：根级 Desktop/Web 命令以及 `check:web`。
- `desktop/vite.config.ts`：共享源码的 Desktop/Web 双输出配置。
- `desktop/src/lib/desktopHost/types.ts`：capability 类型，是 UI 功能可用性的唯一事实来源。
- `desktop/src/lib/desktopHost/browserHost.ts`：Clipboard、Notification、外链等浏览器替代实现，以及所有原生能力的 false 声明。
- `desktop/src/lib/desktopHost/electronHost.ts`：Electron 原生 capability 声明和 preload bridge 适配。
- `desktop/src/lib/desktopRuntime.ts`：浏览器 server URL、token 初始化以及地址栏敏感参数清除。
- `desktop/src/pages/Settings.tsx`：设置导航 capability 过滤、无效持久化 tab 回退和移动布局。
- `desktop/src/components/layout/{Sidebar,TabBar,ContentRouter}.tsx`：导航、终端和原生菜单入口过滤。
- `desktop/src/components/workbench/{WorkbenchPanel,WorkbenchTab}.tsx`：WebView/Browser surface 的 Desktop-only 挂载边界。
- `desktop/src/stores/settingsStore.ts`：Web 不读取 Desktop-only H5 管理控制面。
- `src/server/index.ts`：HTTP/WS 请求分类、鉴权、CORS、静态服务和 Web policy 接入点。
- `src/server/webAccessPolicy.ts`：远程 Web 原生高权限 REST denylist。
- `src/server/ws/handler.ts`：H5 WebSocket 消息过滤和 Computer Use 拒绝。
- `src/server/services/h5AccessService.ts`：服务端部署 token/origin override。
- `src/server/staticH5.ts`：静态资源、SPA fallback 和安全响应头。
- `docs/internals/server.md`、`docs/en/internals/server.md`：中英文 Web 部署、安全和功能差异说明。
- `artifacts/web-acceptance/`、`artifacts/independent-checker/`：本次浏览器验收截图；属于本地证据，不应提交生成物。

## 已实现功能

### Desktop 与 Web 公共功能

已通过共享 REST/WS 和共享页面保留：会话创建/切换/重命名/删除/恢复、消息流式输出/中断/重试、普通工具权限审批、附件上传、工作区文件、Diff/变更、Provider/模型、Agent、Skill、Plugin、MCP、Task、定时任务、Trace、Memory、诊断、统计、主题、语言及可持久化设置。

移动 Web 可进入聊天之外的设置、定时任务和市场页面，设置页使用响应式导航；390×844 实测无横向溢出。

### Web 浏览器替代

- 文件附件使用浏览器上传，不伪装成本机绝对路径选择。
- 剪贴板使用 Clipboard API。
- 通知使用 Notification API。
- 外部/预览链接使用浏览器新窗口。
- URL 中的 `token` 或 `h5Token` 被读取后立即通过 `history.replaceState` 清除，启动错误页也不展示敏感 URL。

### Web 隐藏和服务端禁止的能力

Web 不挂载原生路径/目录选择、PTY、Electron 窗口控制、更新/重启、便携目录、宠物、原生 WebContentsView、IDE/文件管理器启动、Computer Use、Adapter 生命周期及 H5 管理控制面。相关导航、设置 tab、菜单、快捷入口、右键动作和事件注册也被移除。

服务端对 H5 browser 拒绝 `open-targets`、Computer Use、Doctor repair、Adapter 写操作和宠物设置写操作；普通 Sidebar/Profile 设置仍允许。路径匹配必须使用“精确路径或子路径”语义，避免尾随段绕过。

## 关键设计决策

1. 使用同一个 Vite 配置产生两个输出目录，而不是复制前端。这让 Desktop 继续使用相对资源路径，同时 Web 深层路由使用根路径资源和 SPA fallback。
2. capability 是所有 UI 入口和事件挂载的唯一依据。当前能力包括 `adapterLifecycle`、`appMode`、`clipboard`、`computerUse`、`dialogs`、`externalLinks`、`h5AccessControl`、`nativeFilePaths`、`notifications`、`pets`、`previewWebview`、`shell`、`terminal` 和 `windowControls`。
3. 构建目标只决定输出默认值，不作为安全判断。远程安全必须由 Bun 请求分类和服务端 policy 强制执行。
4. Web 生产采用 Bun 同源服务，不使用 `vite preview`，以确保 REST、WebSocket、鉴权、CORS 和静态资源是一个可部署单元。
5. `CLAUDE_H5_TOKEN`仅由服务端读取，不写回用户配置、不进入 Vite bundle；`CLAUDE_H5_ALLOWED_ORIGINS`只接受逗号分隔的精确 origin，拒绝 wildcard。
6. `?petWindow=1`只有具备 `pets` capability 时才进入 Pet renderer；浏览器会进入正常主应用。
7. Browser/WebView 的持久化 mode 在 Web 中回退到 Workspace，避免仅隐藏 tab 后仍初始化原生 surface。

## 配置与环境变量

常用命令：

```bash
bun run desktop:dev
bun run desktop:build
bun run desktop:package

bun run web:dev
bun run web:build
bun run web:start
bun run check:web
```

Web 生产环境：

- `SERVER_HOST`：默认 `127.0.0.1`；局域网常用 `0.0.0.0`，必须显式设置。
- `SERVER_PORT`：Bun 服务端端口。
- `CLAUDE_H5_DIST_DIR`：Web 静态目录；`web:start`默认使用 `desktop/web-dist`。
- `CLAUDE_H5_TOKEN`：16–512 个可见 ASCII 字符的服务端部署 token。
- `CLAUDE_H5_ALLOWED_ORIGINS`：逗号分隔的精确浏览器 origins，不能使用 `*`。
- `CLAUDE_H5_PUBLIC_BASE_URL` / `CLAUDE_H5_AUTO_PUBLIC_URL`：沿用已有 H5 公开地址逻辑。

不要把 token 放入 `VITE_*`、URL、前端文件或普通日志。公开网络必须使用 HTTPS，并让反向代理覆盖静态资源、`/api`、`/proxy` 和 `/ws`。

## 当前限制和已知问题

- Low：Web bundle 仍静态包含部分仅 Desktop capability 才可能挂载的 BrowserSurface、xterm 和 Pet renderer 代码，增加包体；没有 Electron、Node builtin、preload 运行时依赖，也没有可访问的 Web 入口。后续可通过基于 target 的 lazy chunk 拆分优化，但不能复制页面或削弱运行时 capability。
- 仓库完整 `bun run verify`尚未通过：`check:native`中的 Electron sidecar health probe 在当前环境挂起并被人工中止。
- `bun run check:server`当前为 2780 passed、18 failed；失败集中在既有临时 HOME/project registry 隔离路径，不属于本次 Web 改动，尚未修复。
- `bun run check:docs`的安装、站点构建、78 页和 321 个链接检查通过，但最后 Node 收到未展开的 `src/**/*.test.js` glob 后失败。
- `bun run check:coverage`为 1 lane passed、5 failed；存在根测试发现为 0/257 和无关 MessageList 波动。
- 当前环境 Bun 1.3.13，仓库期望 1.3.14，可能影响全量验证复现。
- 未运行真实模型检查，也未消耗 live Provider 额度；流式消息和权限验收使用确定性 mock SDK CLI。
- 没有临时空实现、假按钮或 capability 绕过代码。Desktop 旧的原生流程有意保留。

## 后续待办

建议按以下顺序继续：

1. 在 Bun 1.3.14 环境复现 `electron/services/sidecarManager.test.ts` health probe 超时，先解决或确认环境原因，再重跑 `bun run check:native`和 `bun run verify`。
2. 修复 `check:server`的临时 HOME/project registry 测试隔离；重点阅读相应失败测试的 config/project registry 初始化路径。此项与步骤 1 可并行调查，但合入前都需全量复测。
3. 修复 `check:docs`中 Node test glob 的跨 shell 展开问题，再重跑文档检查。
4. 调查 coverage 的测试发现和 MessageList 波动，使 `bun run check:coverage`稳定。
5. 在不复制业务前端的前提下，将 BrowserSurface、xterm、Pet renderer 拆成 Desktop-only lazy chunks，比较 `desktop/web-dist/assets`前后体积并重跑 Web/Desktop browser smoke。

涉及 Web 能力或安全边界时优先阅读：

- `desktop/src/lib/desktopHost/types.ts`
- `desktop/src/lib/desktopHost/browserHost.ts`
- `desktop/src/lib/desktopHost/electronHost.ts`
- `src/server/index.ts`
- `src/server/webAccessPolicy.ts`
- `src/server/ws/handler.ts`
- `docs/internals/server.md`

## 验证方式

本次实际执行并通过：

- `bun run check:web`：服务端 52 passed；Desktop/Web 前端 14 files、272 passed；TypeScript 和 Web production build 通过。
- `bun run check:desktop`：3852 passed、2 skipped。
- `bun run check:chat-contract`：WS 33、conversation 106、Desktop chat 185，全部通过。
- `bun run check:policy`：128 passed。
- `bun run check:impact`：通过。
- `bun run desktop:build`：renderer、Electron main 和全部 preload build 通过。
- `CSC_IDENTITY_AUTO_DISCOVERY=false bun run electron:package:dir`：Linux x64 directory package 通过。
- `bun run test:package-smoke:current`：通过。
- `bun run web:dev`：Vite UI 和 API health 返回 200；验证后主动停止，退出码 130。
- `bun run web:start`：loopback 与显式远程模式均实际启动并验证。
- `git diff --check`：通过。

真实界面检查：

- Web 1440×900：连接、空/已有会话、流式消息、权限审批、附件、Workspace/Diff、Provider、设置、Agent、Skill、Plugin、MCP、Trace、定时任务、Market。
- Web 390×844：空会话、移动导航、设置和返回行为。
- Desktop renderer：通过 Playwright Electron + Xvfb 检查空会话、设置、Workbench 和原生入口。
- 独立检查者最终结论：Blocker 0、High 0、Medium 0、Low 1。

未通过或未完成的全量检查已逐项记录在“当前限制和已知问题”，不得将其表述为已通过。

## 修改历史

### 2026-08-01：Desktop/Web 双发行与运行模式

- 任务目标：让 cc-haha 在保持 Electron Desktop 全部能力的同时，正式支持共享 React 前端与 Bun 服务端组成的可开发、构建、部署 Web 模式。
- 完成内容：增加 Web 命令和独立产物；统一并补全 host capability；移除 Web 原生入口；增加浏览器替代；强化远程 REST/WS 权限；完善 token、CORS、静态资源和 SPA fallback；补充中英文部署文档、回归测试、浏览器截图和独立验收。
- 主要文件：`package.json`、`desktop/vite.config.ts`、`desktop/src/lib/desktopHost/*`、`desktop/src/pages/Settings.tsx`、`desktop/src/components/layout/*`、`desktop/src/components/workbench/*`、`src/server/index.ts`、`src/server/webAccessPolicy.ts`、`src/server/ws/handler.ts`、`src/server/services/h5AccessService.ts`、`src/server/staticH5.ts`及同区域测试。
- 设计决策：单一前端源码、双 Vite 输出；UI capability 与服务端 enforcement 分层；Bun 同源发布生产 Web；远程访问默认关闭并要求专用 token 与 exact origins。
- 验证结果：Web/desktop build、定向测试、package smoke、真实 Web/Desktop renderer、远程安全和独立检查均完成；独立结论无 Blocker/High/Medium。
- 遗留问题：全量 `verify`受既有 native health probe 挂起影响；server/docs/coverage 的现存失败和 Web bundle 体积优化待后续处理。

### 2026-08-01：建立跨会话上下文维护规则

- 任务目标：让后续 Codex 会话能从代码当前状态继续工作。
- 完成内容：创建本文件；根 `AGENTS.md`要求会话开始先读上下文，并在行为、架构、配置或目录变化后更新。
- 主要文件：`CODEX_CONTEXT.md`、`AGENTS.md`。
- 设计决策：上下文是导航和交接材料，代码始终是最终事实来源；验证状态必须区分通过、失败、跳过和未验证。
- 验证结果：文档内容根据当前工作树、已执行命令和独立检查报告编写；执行 Markdown whitespace/diff 检查。
- 遗留问题：后续每个改变项目状态的会话都必须持续维护本文，避免信息过时。
