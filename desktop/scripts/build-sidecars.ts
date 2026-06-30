import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import {
  compileUnifiedSidecar,
  mapTargetTripleToBun as resolveBunTarget,
} from '../../scripts/sidecar/shared.js'

const desktopRoot = path.resolve(import.meta.dir, '..')
const repoRoot = path.resolve(desktopRoot, '..')
const binariesDir = path.join(desktopRoot, 'src-tauri', 'binaries')

const targetTriple =
  process.env.TAURI_ENV_TARGET_TRIPLE ||
  process.env.CARGO_BUILD_TARGET ||
  (await detectHostTriple())

const bunTarget = mapTargetTripleToBun(targetTriple)

// 编译前先扫一遍 src/ 把所有缺失的 ant-internal 模块在磁盘上 stub 出来。
// 见 desktop/scripts/scan-missing-imports.ts。
console.log('[build-sidecars] scanning for missing imports...')
const scanProc = Bun.spawn(
  ['bun', 'run', path.join(desktopRoot, 'scripts/scan-missing-imports.ts')],
  { cwd: repoRoot, stdout: 'inherit', stderr: 'inherit' },
)
const scanExit = await scanProc.exited
if (scanExit !== 0) {
  throw new Error(`[build-sidecars] scan-missing-imports failed (exit ${scanExit})`)
}

await mkdir(binariesDir, { recursive: true })

// 单一合并 sidecar：server / cli 共享一份 bun runtime + 共享依赖代码。
// 调用方（Tauri lib.rs / conversationService）通过第一个 positional 参数
// 选择 'server' 或 'cli' 模式，详见 desktop/sidecars/claude-sidecar.ts。
await compileUnifiedSidecar({
  entrypoint: path.join(desktopRoot, 'sidecars/claude-sidecar.ts'),
  outfileBase: path.join(binariesDir, `claude-sidecar-${targetTriple}`),
  productName: 'Claude Code Sidecar',
  bunTarget,
})

console.log(`[build-sidecars] Built desktop sidecar for ${targetTriple} (${bunTarget})`)

async function detectHostTriple() {
  const proc = Bun.spawn(['rustc', '-vV'], {
    cwd: repoRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    throw new Error(`[build-sidecars] rustc -vV failed: ${stderr || stdout}`)
  }

  const hostLine = stdout
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('host: '))

  if (!hostLine) {
    throw new Error('[build-sidecars] Could not detect Rust host triple')
  }

  return hostLine.replace('host: ', '')
}

function mapTargetTripleToBun(triple: string) {
  return resolveBunTarget(triple)
}
