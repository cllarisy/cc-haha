import { describe, expect, it } from 'bun:test'
import { isRemoteWebCapabilityDenied } from './webAccessPolicy.js'

describe('remote Web native capability policy', () => {
  it('denies native-machine controls while preserving safe read/business APIs', () => {
    const denied = [
      ['POST', '/api/open-targets/open'],
      ['GET', '/api/computer-use/status'],
      ['POST', '/api/doctor/repair'],
      ['POST', '/api/doctor/repair/trailing'],
      ['PUT', '/api/adapters/telegram'],
      ['PUT', '/api/desktop-ui/preferences/pet'],
      ['PUT', '/api/desktop-ui/preferences/pet/trailing'],
    ] as const
    for (const [method, pathname] of denied) {
      const url = new URL(`https://cc.example${pathname}`)
      expect(isRemoteWebCapabilityDenied(new Request(url, { method }), url)).toBe(true)
    }

    for (const pathname of ['/api/providers', '/api/plugins', '/api/mcp', '/api/doctor/report', '/api/adapters']) {
      const url = new URL(`https://cc.example${pathname}`)
      expect(isRemoteWebCapabilityDenied(new Request(url), url)).toBe(false)
    }

    for (const pathname of [
      '/api/desktop-ui/preferences/sidebar',
      '/api/desktop-ui/preferences/profile',
      '/api/desktop-ui/preferences/profile/avatar',
    ]) {
      const url = new URL(`https://cc.example${pathname}`)
      expect(isRemoteWebCapabilityDenied(new Request(url, { method: 'PUT' }), url)).toBe(false)
    }
  })
})
