import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Settings } from '../pages/Settings'
import { useSettingsStore } from '../stores/settingsStore'
import { useUIStore } from '../stores/uiStore'
import { browserHost } from '../lib/desktopHost/browserHost'

vi.mock('../features/pets/PetSettings', () => ({
  PetSettings: () => <div>Pet settings content</div>,
}))

describe('Settings pet navigation', () => {
  beforeEach(() => {
    window.desktopHost = {
      ...browserHost,
      kind: 'electron',
      isDesktop: true,
      capabilities: { ...browserHost.capabilities, pets: true },
    }
    useSettingsStore.setState({ locale: 'en' })
    useUIStore.setState({ activeSettingsTab: 'providers', pendingSettingsTab: null })
  })

  it('opens the dedicated pet settings tab and persists it as active', () => {
    render(<Settings />)

    fireEvent.click(screen.getByRole('button', { name: 'Pets' }))

    expect(screen.getByText('Pet settings content')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pets' })).toHaveAttribute('aria-current', 'page')
    expect(useUIStore.getState().activeSettingsTab).toBe('pets')
  })
})
