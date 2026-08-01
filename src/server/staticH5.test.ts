import { afterEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { handleStaticH5Request } from './staticH5.js'

const originalDist = process.env.CLAUDE_H5_DIST_DIR

afterEach(() => {
  if (originalDist === undefined) delete process.env.CLAUDE_H5_DIST_DIR
  else process.env.CLAUDE_H5_DIST_DIR = originalDist
})

async function fixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-haha-static-h5-'))
  await fs.mkdir(path.join(dir, 'assets'))
  await fs.writeFile(path.join(dir, 'index.html'), '<main>cc-haha web</main>')
  await fs.writeFile(path.join(dir, 'assets', 'app.js'), 'console.log("ok")')
  process.env.CLAUDE_H5_DIST_DIR = dir
  return dir
}

describe('static Web distribution', () => {
  it('serves SPA fallbacks and security headers', async () => {
    await fixture()
    const url = new URL('http://127.0.0.1:3456/settings/providers')
    const response = await handleStaticH5Request(new Request(url), url)

    expect(response?.status).toBe(200)
    expect(await response?.text()).toContain('cc-haha web')
    expect(response?.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response?.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('supports HEAD assets without falling missing dotted files back to HTML', async () => {
    await fixture()
    const assetUrl = new URL('http://127.0.0.1:3456/assets/app.js')
    const head = await handleStaticH5Request(new Request(assetUrl, { method: 'HEAD' }), assetUrl)
    expect(head?.status).toBe(200)
    expect(Number(head?.headers.get('content-length'))).toBeGreaterThan(0)
    expect(head?.headers.get('cache-control')).toContain('immutable')

    const missingUrl = new URL('http://127.0.0.1:3456/assets/missing.js')
    expect(await handleStaticH5Request(new Request(missingUrl), missingUrl)).toBeNull()
  })

  it('rejects encoded path traversal', async () => {
    await fixture()
    const url = new URL('http://127.0.0.1:3456/%2e%2e/package.json')
    expect(await handleStaticH5Request(new Request(url), url)).toBeNull()
  })
})
