import { describe, it, expect, vi } from 'vitest'
import { confirmDialog } from '@/utils/confirm'

vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: vi.fn(),
}))

import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'

describe('confirmDialog', () => {
  it('returns tauriConfirm result when available', async () => {
    vi.mocked(tauriConfirm).mockResolvedValue(true)
    const result = await confirmDialog('Are you sure?')
    expect(result).toBe(true)
    expect(tauriConfirm).toHaveBeenCalledWith('Are you sure?')
  })

  it('falls back to window.confirm when tauriConfirm throws', async () => {
    vi.mocked(tauriConfirm).mockRejectedValue(new Error('not available'))
    window.confirm = vi.fn(() => false)
    const result = await confirmDialog('Fallback?')
    expect(result).toBe(false)
    expect(window.confirm).toHaveBeenCalledWith('Fallback?')
  })
})
