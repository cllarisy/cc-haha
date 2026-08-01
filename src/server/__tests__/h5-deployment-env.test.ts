import { afterEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { H5AccessService } from '../services/h5AccessService.js'

const originalConfigDir = process.env.CLAUDE_CONFIG_DIR
const originalToken = process.env.CLAUDE_H5_TOKEN
const originalOrigins = process.env.CLAUDE_H5_ALLOWED_ORIGINS

afterEach(() => {
  if (originalConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
  else process.env.CLAUDE_CONFIG_DIR = originalConfigDir
  if (originalToken === undefined) delete process.env.CLAUDE_H5_TOKEN
  else process.env.CLAUDE_H5_TOKEN = originalToken
  if (originalOrigins === undefined) delete process.env.CLAUDE_H5_ALLOWED_ORIGINS
  else process.env.CLAUDE_H5_ALLOWED_ORIGINS = originalOrigins
})

describe('headless Web deployment configuration', () => {
  it('enables a dedicated H5 token with exact configured origins without persisting it', async () => {
    process.env.CLAUDE_CONFIG_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-haha-web-env-'))
    process.env.CLAUDE_H5_TOKEN = 'web-deployment-token-1234'
    process.env.CLAUDE_H5_ALLOWED_ORIGINS = 'https://cc.example, https://lan.example:8443'
    const service = new H5AccessService()

    expect((await service.getSettings()).enabled).toBe(true)
    expect(await service.validateToken('web-deployment-token-1234')).toBe(true)
    expect(await service.validateToken('wrong-token')).toBe(false)
    expect(await service.isOriginAllowed('https://cc.example/path')).toBe(true)
    expect(await service.isOriginAllowed('https://evil.example')).toBe(false)
  })

  it('rejects wildcard deployment origins', async () => {
    process.env.CLAUDE_CONFIG_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-haha-web-env-'))
    process.env.CLAUDE_H5_TOKEN = 'web-deployment-token-1234'
    process.env.CLAUDE_H5_ALLOWED_ORIGINS = '*'

    await expect(new H5AccessService().getSettings()).rejects.toThrow('must not contain wildcard')
  })
})
