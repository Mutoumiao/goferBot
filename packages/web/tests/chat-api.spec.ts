import { describe, it, expect, vi } from 'vitest'
import { renameSession } from '@/api/chat'
import { alovaInstance } from '@/utils/server'

vi.mock('@/utils/server', () => ({
  alovaInstance: {
    Post: vi.fn(),
  },
}))

describe('chatApi.renameSession', () => {
  it('AC-06: renames session with id and title via POST /rename', () => {
    const mockPost = vi.fn()
    vi.mocked(alovaInstance.Post).mockReturnValue(mockPost as any)

    renameSession('sess-1', 'New Title')

    expect(alovaInstance.Post).toHaveBeenCalledWith('/sessions/sess-1/rename', { title: 'New Title' })
  })

  it('AC-06: handles empty title gracefully (trims whitespace)', () => {
    const mockPost = vi.fn()
    vi.mocked(alovaInstance.Post).mockReturnValue(mockPost as any)

    renameSession('sess-1', '  Updated  ')

    expect(alovaInstance.Post).toHaveBeenCalledWith('/sessions/sess-1/rename', { title: '  Updated  ' })
  })
})
