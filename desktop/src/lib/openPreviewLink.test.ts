// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browserHost } from './desktopHost/browserHost'

const { openBrowser, openPreview } = vi.hoisted(() => ({
  openBrowser: vi.fn(),
  openPreview: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./desktopRuntime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./desktopRuntime')>()),
  getServerBaseUrl: () => 'http://127.0.0.1:4321',
}))
vi.mock('../stores/browserPanelStore', () => ({
  useBrowserPanelStore: { getState: () => ({ open: openBrowser }) },
}))
vi.mock('../stores/workspacePanelStore', () => ({
  useWorkspacePanelStore: { getState: () => ({ openPreview }) },
}))

import { openPreviewLink } from './openPreviewLink'

describe('openPreviewLink host fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Reflect.deleteProperty(window, 'desktopHost')
    window.open = vi.fn()
  })

  it('opens a loopback preview with the standard browser API in Web', () => {
    expect(openPreviewLink('http://localhost:5173/result', 's1')).toBe(true)

    expect(window.open).toHaveBeenCalledWith(
      'http://localhost:5173/result',
      '_blank',
      'noopener,noreferrer',
    )
    expect(openBrowser).not.toHaveBeenCalled()
  })

  it('keeps the embedded preview route in Desktop', () => {
    window.desktopHost = {
      ...browserHost,
      kind: 'electron',
      isDesktop: true,
      capabilities: { ...browserHost.capabilities, previewWebview: true },
    }

    expect(openPreviewLink('http://localhost:5173/result', 's1')).toBe(true)
    expect(openBrowser).toHaveBeenCalledWith('s1', 'http://localhost:5173/result')
    expect(window.open).not.toHaveBeenCalled()
  })
})
