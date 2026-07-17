import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearUserClientState } from '@/lib/session-cleanup'
import { useConversationStore } from '@/stores/conversation.store'

describe('clearUserClientState', () => {
  beforeEach(() => {
    useConversationStore.getState().reset()
    sessionStorage.setItem('gofer-workspace-v1', JSON.stringify({ tabs: [{ id: 'x' }] }))
  })

  it('clears legacy workspace storage and conversation store', () => {
    useConversationStore.getState().getOrCreateConversation('c1')
    expect(useConversationStore.getState().conversationMap.c1).toBeDefined()

    clearUserClientState()

    expect(sessionStorage.getItem('gofer-workspace-v1')).toBeNull()
    expect(useConversationStore.getState().conversationMap).toEqual({})
  })

  it('does not throw when sessionStorage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => clearUserClientState()).not.toThrow()
    spy.mockRestore()
  })
})
