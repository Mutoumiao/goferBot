import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/api/chat', () => ({
  getSessions: vi.fn(() => ({ send: vi.fn() })),
  createSession: vi.fn(() => ({ send: vi.fn() })),
  deleteSession: vi.fn(() => ({ send: vi.fn() })),
  renameSession: vi.fn(() => ({ send: vi.fn() })),
  getHistory: vi.fn(() => ({ send: vi.fn() })),
}))

import {
  getSessions,
  createSession as apiCreateSession,
  deleteSession as apiDeleteSession,
  renameSession as apiRenameSession,
  getHistory,
} from '@/api/chat'
import { useChatStore } from '@/features/chat/store'
import {
  loadChatSessions,
  createChatSession,
  renameChatSession,
  deleteChatSession,
  loadChatHistory,
  resolveSessionById,
} from '@/features/chat/services'
import type { Session, Message } from '@goferbot/data'

describe('chat services', () => {
  beforeEach(() => {
    useChatStore.setState({
      activeSession: null,
      messages: [],
      isLoadingHistory: false,
      isStreaming: false,
      streamingContent: '',
      sessions: [],
      isLoadingSessions: false,
      error: null,
    })
    vi.clearAllMocks()
  })

  describe('loadChatSessions', () => {
    it('sets sessions on success', async () => {
      const sessions: Session[] = [{ id: 's1', title: 'A', messageCount: 0, createdAt: '', updatedAt: '' }]
      vi.mocked(getSessions).mockReturnValue({ send: vi.fn().mockResolvedValue({ sessions }) } as any)

      await loadChatSessions()

      expect(useChatStore.getState().sessions).toEqual(sessions)
      expect(useChatStore.getState().isLoadingSessions).toBe(false)
      expect(useChatStore.getState().error).toBeNull()
    })

    it('sets error on failure', async () => {
      vi.mocked(getSessions).mockReturnValue({ send: vi.fn().mockRejectedValue(new Error('fail')) } as any)

      await loadChatSessions()

      expect(useChatStore.getState().error).toBe('fail')
      expect(useChatStore.getState().isLoadingSessions).toBe(false)
    })
  })

  describe('createChatSession', () => {
    it('adds session and sets active on success', async () => {
      const session: Session = { id: 's1', title: 'New', messageCount: 0, createdAt: '', updatedAt: '' }
      vi.mocked(apiCreateSession).mockReturnValue({ send: vi.fn().mockResolvedValue(session) } as any)

      const result = await createChatSession()

      expect(result).toEqual(session)
      expect(useChatStore.getState().sessions).toContainEqual(session)
      expect(useChatStore.getState().activeSession).toEqual(session)
    })

    it('returns undefined and sets error on failure', async () => {
      vi.mocked(apiCreateSession).mockReturnValue({ send: vi.fn().mockRejectedValue(new Error('create fail')) } as any)

      const result = await createChatSession()

      expect(result).toBeUndefined()
      expect(useChatStore.getState().error).toBe('create fail')
    })
  })

  describe('renameChatSession', () => {
    it('updates session title in store on success', async () => {
      useChatStore.setState({ sessions: [{ id: 's1', title: 'Old', messageCount: 0, createdAt: '', updatedAt: '' }] })
      vi.mocked(apiRenameSession).mockReturnValue({ send: vi.fn().mockResolvedValue(undefined) } as any)

      await renameChatSession('s1', 'New Title')

      expect(useChatStore.getState().sessions[0].title).toBe('New Title')
    })

    it('does nothing for empty title', async () => {
      await renameChatSession('s1', '  ')
      expect(apiRenameSession).not.toHaveBeenCalled()
    })

    it('sets error on failure', async () => {
      useChatStore.setState({ sessions: [{ id: 's1', title: 'Old', messageCount: 0, createdAt: '', updatedAt: '' }] })
      vi.mocked(apiRenameSession).mockReturnValue({ send: vi.fn().mockRejectedValue(new Error('rename fail')) } as any)

      await renameChatSession('s1', 'New')

      expect(useChatStore.getState().error).toBe('rename fail')
    })
  })

  describe('deleteChatSession', () => {
    it('removes session and clears active if matched', async () => {
      useChatStore.setState({
        sessions: [
          { id: 's1', title: 'A', messageCount: 0, createdAt: '', updatedAt: '' },
          { id: 's2', title: 'B', messageCount: 0, createdAt: '', updatedAt: '' },
        ],
        activeSession: { id: 's1', title: 'A', messageCount: 0, createdAt: '', updatedAt: '' },
      })
      vi.mocked(apiDeleteSession).mockReturnValue({ send: vi.fn().mockResolvedValue(undefined) } as any)

      await deleteChatSession('s1')

      expect(useChatStore.getState().sessions).toHaveLength(1)
      expect(useChatStore.getState().activeSession).toBeNull()
    })

    it('removes session without clearing active if not matched', async () => {
      useChatStore.setState({
        sessions: [
          { id: 's1', title: 'A', messageCount: 0, createdAt: '', updatedAt: '' },
          { id: 's2', title: 'B', messageCount: 0, createdAt: '', updatedAt: '' },
        ],
        activeSession: { id: 's2', title: 'B', messageCount: 0, createdAt: '', updatedAt: '' },
      })
      vi.mocked(apiDeleteSession).mockReturnValue({ send: vi.fn().mockResolvedValue(undefined) } as any)

      await deleteChatSession('s1')

      expect(useChatStore.getState().activeSession?.id).toBe('s2')
    })

    it('sets error on failure', async () => {
      useChatStore.setState({ sessions: [{ id: 's1', title: 'A', messageCount: 0, createdAt: '', updatedAt: '' }] })
      vi.mocked(apiDeleteSession).mockReturnValue({ send: vi.fn().mockRejectedValue(new Error('del fail')) } as any)

      await deleteChatSession('s1')

      expect(useChatStore.getState().error).toBe('del fail')
    })
  })

  describe('loadChatHistory', () => {
    it('sets messages on success', async () => {
      const messages: Message[] = [{ id: 'm1', sessionId: 's1', role: 'user', content: 'hi', createdAt: '' }]
      vi.mocked(getHistory).mockReturnValue({ send: vi.fn().mockResolvedValue({ messages }) } as any)

      await loadChatHistory('s1')

      expect(useChatStore.getState().messages).toEqual(messages)
      expect(useChatStore.getState().isLoadingHistory).toBe(false)
    })

    it('silently handles error and resets loading', async () => {
      vi.mocked(getHistory).mockReturnValue({ send: vi.fn().mockRejectedValue(new Error('hist fail')) } as any)

      await loadChatHistory('s1')

      expect(useChatStore.getState().isLoadingHistory).toBe(false)
      expect(useChatStore.getState().messages).toHaveLength(0)
    })
  })

  describe('resolveSessionById', () => {
    it('sets active from existing sessions without refresh', async () => {
      useChatStore.setState({
        sessions: [{ id: 's1', title: 'A', messageCount: 0, createdAt: '', updatedAt: '' }],
      })

      const result = await resolveSessionById('s1')

      expect(result?.id).toBe('s1')
      expect(useChatStore.getState().activeSession?.id).toBe('s1')
      expect(getSessions).not.toHaveBeenCalled()
    })

    it('refreshes sessions and sets active when not found locally', async () => {
      useChatStore.setState({ sessions: [] })
      vi.mocked(getSessions).mockReturnValue({
        send: vi.fn().mockResolvedValue({ sessions: [{ id: 's1', title: 'A', messageCount: 0, createdAt: '', updatedAt: '' }] }),
      } as any)

      const result = await resolveSessionById('s1')

      expect(result?.id).toBe('s1')
      expect(useChatStore.getState().activeSession?.id).toBe('s1')
    })

    it('returns undefined when session not found after refresh', async () => {
      useChatStore.setState({ sessions: [] })
      vi.mocked(getSessions).mockReturnValue({ send: vi.fn().mockResolvedValue({ sessions: [] }) } as any)

      const result = await resolveSessionById('s1')

      expect(result).toBeUndefined()
      expect(useChatStore.getState().activeSession).toBeNull()
    })
  })
})
