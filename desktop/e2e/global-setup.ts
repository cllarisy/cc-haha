import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export default async function globalSetup() {
  const desktopDir = path.resolve(here, '..')
  const distWebIndex = path.resolve(desktopDir, 'dist-web', 'index.html')
  if (fs.existsSync(distWebIndex)) {
    console.log('[e2e] dist-web/index.html already exists; skipping build:web')
    return
  }
  console.log('[e2e] building web target...')
  execSync('bun run build:web', { cwd: desktopDir, stdio: 'inherit' })
}
