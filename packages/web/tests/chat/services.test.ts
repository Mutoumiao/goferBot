import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/chat', () => ({
  getSessions: vi.fn(() => ({ send: vi.fn() })),
  getSessionById: vi.fn(() => ({ send: vi.fn() })),
  createSession: vi.fn(() => ({ send: vi.fn() })),
  deleteSession: vi.fn(() => ({ send: vi.fn() })),
  renameSession: vi.fn(() => ({ send: vi.fn() })),
  getMessages: vi.fn(() => ({ send: vi.fn() })),
}))

import type { Message, Session } from '@goferbot/data'
import {
  createSession as apiCreateSession,
  deleteSession as apiDeleteSession,
  renameSession as apiRenameSession,
  getMessages,
  getSessionById,
  getSessions,
} from '@/api/chat'
import { getPendingMessageKey } from '@/features/chat/constants'
import {
  createChatSession,
  deleteChatSession,
  loadChatHistory,
  loadChatSessions,
  renameChatSession,
  resolveSessionById,
  submitTempChat,
} from '@/features/chat/services'
import { useChatStore } from '@/features/chat/store'
import { useConversationStore } from '@/stores/conversation.store'

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
    useConversationStore.setState({ conversationMap: {} })
    vi.clearAllMocks()
  })

  describe('loadChatSessions', () => {
    it('sets sessions on success', async () => {
      const sessions: Session[] = [
        { id: 's1', title: 'A', messageCount: 0, createdAt: '', updatedAt: '' },
      ]
      vi.mocked(getSessions).mockReturnValue({
        send: vi.fn().mockResolvedValue({ items: sessions }),
      } as any)

      await loadChatSessions()

      expect(useChatStore.getState().sessions).toEqual(sessions)
      expect(useChatStore.getState().isLoadingSessions).toBe(false)
      expect(useChatStore.getState().error).toBeNull()
    })

    it('sets error on failure', async () => {
      vi.mocked(getSessions).mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('fail')),
      } as any)

      await loadChatSessions()

      expect(useChatStore.getState().error).toBe('fail')
      expect(useChatStore.getState().isLoadingSessions).toBe(false)
    })
  })

  describe('createChatSession', () => {
    it('adds session and sets active on success', async () => {
      const session: Session = {
        id: 's1',
        title: 'New',
        messageCount: 0,
        createdAt: '',
        updatedAt: '',
      }
      vi.mocked(apiCreateSession).mockReturnValue({
        send: vi.fn().mockResolvedValue(session),
      } as any)

      const result = await createChatSession()

      expect(result).toEqual(session)
      expect(useChatStore.getState().sessions).toContainEqual(session)
      expect(useChatStore.getState().activeSession).toEqual(session)
    })

    it('returns undefined and sets error on failure', async () => {
      vi.mocked(apiCreateSession).mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('create fail')),
      } as any)

      const result = await createChatSession()

      expect(result).toBeUndefined()
      expect(useChatStore.getState().error).toBe('create fail')
    })
  })

  describe('renameChatSession', () => {
    it('updates session title in store on success', async () => {
      useChatStore.setState({
        sessions: [{ id: 's1', title: 'Old', messageCount: 0, createdAt: '', updatedAt: '' }],
      })
      vi.mocked(apiRenameSession).mockReturnValue({
        send: vi.fn().mockResolvedValue(undefined),
      } as any)

      await renameChatSession('s1', 'New Title')

      expect(useChatStore.getState().sessions[0].title).toBe('New Title')
    })

    it('does nothing for empty title', async () => {
      await renameChatSession('s1', '  ')
      expect(apiRenameSession).not.toHaveBeenCalled()
    })

    it('sets error on failure', async () => {
      useChatStore.setState({
        sessions: [{ id: 's1', title: 'Old', messageCount: 0, createdAt: '', updatedAt: '' }],
      })
      vi.mocked(apiRenameSession).mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('rename fail')),
      } as any)

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
      vi.mocked(apiDeleteSession).mockReturnValue({
        send: vi.fn().mockResolvedValue(undefined),
      } as any)

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
      vi.mocked(apiDeleteSession).mockReturnValue({
        send: vi.fn().mockResolvedValue(undefined),
      } as any)

      await deleteChatSession('s1')

      expect(useChatStore.getState().activeSession?.id).toBe('s2')
    })

    it('sets error on failure', async () => {
      useChatStore.setState({
        sessions: [{ id: 's1', title: 'A', messageCount: 0, createdAt: '', updatedAt: '' }],
      })
      vi.mocked(apiDeleteSession).mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('del fail')),
      } as any)

      await deleteChatSession('s1')

      expect(useChatStore.getState().error).toBe('del fail')
    })
  })

  describe('loadChatHistory', () => {
    it('sets messages into conversation store on success', async () => {
      const messages: Message[] = [
        { id: 'm1', sessionId: 's1', role: 'user', content: 'hi', createdAt: '' },
      ]
      vi.mocked(getMessages).mockReturnValue({
        send: vi.fn().mockResolvedValue({ items: messages }),
      } as any)

      await loadChatHistory('s1')

      expect(useConversationStore.getState().conversationMap.s1?.messages).toEqual(messages)
      expect(useChatStore.getState().isLoadingHistory).toBe(false)
    })

    it('silently handles error and resets loading', async () => {
      vi.mocked(getMessages).mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('hist fail')),
      } as any)

      await loadChatHistory('s1')

      expect(useChatStore.getState().isLoadingHistory).toBe(false)
      expect(useConversationStore.getState().conversationMap.s1).toBeUndefined()
    })
  })

  describe('resolveSessionById', () => {
    it('fetches session by id and sets active', async () => {
      useChatStore.setState({
        sessions: [{ id: 's1', title: 'A', messageCount: 0, createdAt: '', updatedAt: '' }],
      })
      vi.mocked(getSessionById).mockReturnValue({
        send: vi.fn().mockResolvedValue({
          id: 's1',
          title: 'A',
          messageCount: 0,
          createdAt: '',
          updatedAt: '',
        }),
      } as any)

      const result = await resolveSessionById('s1')

      expect(result?.id).toBe('s1')
      expect(useChatStore.getState().activeSession?.id).toBe('s1')
      expect(getSessionById).toHaveBeenCalledWith('s1')
    })

    it('returns undefined when session not found', async () => {
      useChatStore.setState({ sessions: [] })
      vi.mocked(getSessionById).mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('not found')),
      } as any)

      const result = await resolveSessionById('s1')

      expect(result).toBeUndefined()
      expect(useChatStore.getState().activeSession).toBeNull()
    })
  })

  describe('submitTempChat', () => {
    beforeEach(() => {
      sessionStorage.clear()
    })

    it('creates session and stores pending message as JSON', async () => {
      const session: Session = {
        id: 's1',
        title: 'New',
        messageCount: 0,
        createdAt: '',
        updatedAt: '',
      }
      vi.mocked(apiCreateSession).mockReturnValue({
        send: vi.fn().mockResolvedValue(session),
      } as any)
      const result = await submitTempChat('hello world')

      expect(result).toBe('s1')
      const stored = sessionStorage.getItem(getPendingMessageKey('s1'))
      expect(stored).toBeDefined()
      expect(JSON.parse(stored ?? '{}')).toEqual({ content: 'hello world' })
    })

    it('stores knowledgeBaseIds in pending JSON when provided', async () => {
      const session: Session = {
        id: 's2',
        title: 'New',
        messageCount: 0,
        createdAt: '',
        updatedAt: '',
      }
      vi.mocked(apiCreateSession).mockReturnValue({
        send: vi.fn().mockResolvedValue(session),
      } as any)

      await submitTempChat('hello', { knowledgeBaseIds: ['kb1', 'kb2'] })

      const stored = sessionStorage.getItem(getPendingMessageKey('s2'))
      expect(JSON.parse(stored ?? '{}')).toEqual({
        content: 'hello',
        knowledgeBaseIds: ['kb1', 'kb2'],
      })
    })

    it('returns null when session creation fails', async () => {
      vi.mocked(apiCreateSession).mockReturnValue({ send: vi.fn().mockResolvedValue(null) } as any)

      const result = await submitTempChat('hello')

      expect(result).toBeNull()
      expect(sessionStorage.length).toBe(0)
    })
  })
})
