# Claude Code Haha Desktop

Electron + React 桌面客户端，也是 Web 模式复用的唯一前端源码。

## 开发

```bash
bun install
bun run electron:dev
```

## 构建

```bash
# 构建 Electron renderer、sidecar 与主进程
bun run electron:build

# 打包当前平台
bun run electron:package

# 仅构建 Web 静态产物（在仓库根目录）
bun run web:build
```

构建产物位于 `build-artifacts/` 目录，文件名会显式包含平台、架构和包类型。

## 常见问题

### macOS 提示"已损坏，无法打开"

```bash
xattr -cr /Applications/Claude\ Code\ Haha.app
```
