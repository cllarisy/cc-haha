// @vitest-environment jsdom

import '@testing-library/jest-dom'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browserHost } from '../../lib/desktopHost/browserHost'
import { useBrowserPanelStore } from '../../stores/browserPanelStore'
import { useWorkspacePanelStore } from '../../stores/workspacePanelStore'

vi.mock('./WorkbenchPanel', () => ({
  WorkbenchPanel: ({ sessionId }: { sessionId: string }) => <div>workbench:{sessionId}</div>,
}))

import { WorkbenchTab } from './WorkbenchTab'

const SESSION_ID = 'workbench-session'

beforeEach(() => {
  useBrowserPanelStore.setState(useBrowserPanelStore.getInitialState(), true)
  useWorkspacePanelStore.setState(useWorkspacePanelStore.getInitialState(), true)
  useWorkspacePanelStore.getState().setMode(SESSION_ID, 'browser')
})

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(window, 'desktopHost')
})

describe('WorkbenchTab browser capability', () => {
  it('does not initialize the native browser state for a persisted browser mode in Web', () => {
    render(<WorkbenchTab tabId="workbench-tab" sessionId={SESSION_ID} />)

    expect(useBrowserPanelStore.getState().bySession[SESSION_ID]).toBeUndefined()
  })

  it('keeps initializing the native browser state in Desktop', () => {
    window.desktopHost = {
      ...browserHost,
      kind: 'electron',
      isDesktop: true,
      capabilities: { ...browserHost.capabilities, previewWebview: true },
    }

    render(<WorkbenchTab tabId="workbench-tab" sessionId={SESSION_ID} />)

    expect(useBrowserPanelStore.getState().bySession[SESSION_ID]).toMatchObject({ url: '', isOpen: true })
  })
})
