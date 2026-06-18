import type { Message, Session } from '@goferbot/data'
import { beforeEach, describe, expect, it } from 'vitest'
import { useChatStore } from '@/features/chat/store'

describe('useChatStore', () => {
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
  })

  describe('初始状态', () => {
    it('has default empty state', () => {
      const state = useChatStore.getState()
      expect(state.activeSession).toBeNull()
      expect(state.messages).toHaveLength(0)
      expect(state.isLoadingHistory).toBe(false)
      expect(state.isStreaming).toBe(false)
      expect(state.streamingContent).toBe('')
      expect(state.sessions).toHaveLength(0)
      expect(state.isLoadingSessions).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('会话状态', () => {
    it('sets active session', () => {
      const session: Session = {
        id: 's1',
        title: 'Test',
        messageCount: 0,
        createdAt: '',
        updatedAt: '',
      }
      useChatStore.getState().setActiveSession(session)
      expect(useChatStore.getState().activeSession?.id).toBe('s1')
    })

    it('sets sessions', () => {
      const sessions: Session[] = [
        { id: 's1', title: 'A', messageCount: 0, createdAt: '', updatedAt: '' },
        { id: 's2', title: 'B', messageCount: 0, createdAt: '', updatedAt: '' },
      ]
      useChatStore.getState().setSessions(sessions)
      expect(useChatStore.getState().sessions).toHaveLength(2)
    })

    it('adds session to front of list', () => {
      useChatStore
        .getState()
        .setSessions([{ id: 's1', title: 'A', messageCount: 0, createdAt: '', updatedAt: '' }])
      useChatStore
        .getState()
        .addSession({ id: 's2', title: 'B', messageCount: 0, createdAt: '', updatedAt: '' })
      expect(useChatStore.getState().sessions[0].id).toBe('s2')
      expect(useChatStore.getState().sessions).toHaveLength(2)
    })

    it('removes session by id', () => {
      useChatStore.getState().setSessions([
        { id: 's1', title: 'A', messageCount: 0, createdAt: '', updatedAt: '' },
        { id: 's2', title: 'B', messageCount: 0, createdAt: '', updatedAt: '' },
      ])
      useChatStore.getState().removeSession('s1')
      expect(useChatStore.getState().sessions).toHaveLength(1)
      expect(useChatStore.getState().sessions[0].id).toBe('s2')
    })

    it('updates session by id', () => {
      useChatStore
        .getState()
        .setSessions([{ id: 's1', title: 'A', messageCount: 0, createdAt: '', updatedAt: '' }])
      useChatStore.getState().updateSession('s1', { title: 'Updated' })
      expect(useChatStore.getState().sessions[0].title).toBe('Updated')
    })

    it('sets loading and error states', () => {
      useChatStore.getState().setIsLoadingSessions(true)
      useChatStore.getState().setError('failed')
      expect(useChatStore.getState().isLoadingSessions).toBe(true)
      expect(useChatStore.getState().error).toBe('failed')
    })

    it('clears error', () => {
      useChatStore.getState().setError('failed')
      useChatStore.getState().clearError()
      expect(useChatStore.getState().error).toBeNull()
    })
  })

  describe('消息管理', () => {
    it('sets messages', () => {
      const messages: Message[] = [
        { id: 'm1', sessionId: 's1', role: 'user', content: 'hello', createdAt: '' },
      ]
      useChatStore.getState().setMessages(messages)
      expect(useChatStore.getState().messages).toHaveLength(1)
    })

    it('appends message', () => {
      useChatStore
        .getState()
        .setMessages([{ id: 'm1', sessionId: 's1', role: 'user', content: 'hello', createdAt: '' }])
      useChatStore.getState().appendMessage({
        id: 'm2',
        sessionId: 's1',
        role: 'assistant',
        content: 'hi',
        createdAt: '',
      })
      expect(useChatStore.getState().messages).toHaveLength(2)
      expect(useChatStore.getState().messages[1].role).toBe('assistant')
    })

    it('sets history loading', () => {
      useChatStore.getState().setIsLoadingHistory(true)
      expect(useChatStore.getState().isLoadingHistory).toBe(true)
    })
  })

  describe('流式内容', () => {
    it('appends stream content', () => {
      useChatStore.getState().appendStreamContent('hello')
      useChatStore.getState().appendStreamContent(' world')
      expect(useChatStore.getState().streamingContent).toBe('hello world')
    })

    it('flushes stream content into message', () => {
      const session: Session = {
        id: 's1',
        title: 'Test',
        messageCount: 0,
        createdAt: '',
        updatedAt: '',
      }
      useChatStore.getState().setActiveSession(session)
      useChatStore
        .getState()
        .setMessages([{ id: 'm1', sessionId: 's1', role: 'user', content: 'q', createdAt: '' }])
      useChatStore.getState().appendStreamContent('answer')
      useChatStore.getState().flushStreamContent()
      const state = useChatStore.getState()
      expect(state.streamingContent).toBe('')
      expect(state.messages).toHaveLength(2)
      expect(state.messages[1].role).toBe('assistant')
      expect(state.messages[1].content).toBe('answer')
    })

    it('does nothing when flushing empty content', () => {
      useChatStore
        .getState()
        .setMessages([{ id: 'm1', sessionId: 's1', role: 'user', content: 'q', createdAt: '' }])
      useChatStore.getState().flushStreamContent()
      expect(useChatStore.getState().messages).toHaveLength(1)
    })

    it('sets streaming state', () => {
      useChatStore.getState().setIsStreaming(true)
      expect(useChatStore.getState().isStreaming).toBe(true)
    })
  })

  describe('clearChat', () => {
    it('resets all chat state', () => {
      useChatStore
        .getState()
        .setActiveSession({ id: 's1', title: 'T', messageCount: 0, createdAt: '', updatedAt: '' })
      useChatStore
        .getState()
        .setMessages([{ id: 'm1', sessionId: 's1', role: 'user', content: 'hi', createdAt: '' }])
      useChatStore.getState().setIsStreaming(true)
      useChatStore.getState().appendStreamContent('data')
      useChatStore.getState().setIsLoadingSessions(true)
      useChatStore.getState().setError('err')

      useChatStore.getState().clearChat()

      const state = useChatStore.getState()
      expect(state.activeSession).toBeNull()
      expect(state.messages).toHaveLength(0)
      expect(state.isStreaming).toBe(false)
      expect(state.streamingContent).toBe('')
      expect(state.isLoadingSessions).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('provider 状态', () => {
    it('sets available providers and picks the first as default', () => {
      const providers = [
        { key: 'deepseek', name: 'DeepSeek', model: 'v3', isBuiltin: true },
        { key: 'openai', name: 'OpenAI', model: 'gpt-4', isBuiltin: false },
      ]
      useChatStore.getState().setAvailableProviders(providers)

      const state = useChatStore.getState()
      expect(state.availableProviders).toEqual(providers)
      expect(state.selectedProviderKey).toBe('deepseek')
    })

    it('keeps existing selected provider when still available', () => {
      useChatStore.setState({ selectedProviderKey: 'openai' })
      const providers = [
        { key: 'deepseek', name: 'DeepSeek', model: 'v3', isBuiltin: true },
        { key: 'openai', name: 'OpenAI', model: 'gpt-4', isBuiltin: false },
      ]
      useChatStore.getState().setAvailableProviders(providers)

      expect(useChatStore.getState().selectedProviderKey).toBe('openai')
    })

    it('sets selected provider key', () => {
      useChatStore.getState().setSelectedProviderKey('deepseek')
      expect(useChatStore.getState().selectedProviderKey).toBe('deepseek')
    })

    it('sets init loading and error states', () => {
      useChatStore.getState().setIsInitLoading(true)
      useChatStore.getState().setInitError('init failed')

      const state = useChatStore.getState()
      expect(state.isInitLoading).toBe(true)
      expect(state.initError).toBe('init failed')
    })
  })

  describe('会话缓存', () => {
    it('sets and gets cached messages', () => {
      const messages: Message[] = [
        { id: 'm1', sessionId: 's1', role: 'user', content: 'hi', createdAt: '' },
      ]
      useChatStore.getState().setCachedMessages('s1', messages)

      expect(useChatStore.getState().getCachedMessages('s1')).toEqual(messages)
      expect(useChatStore.getState().isSessionLoaded('s1')).toBe(false)
    })

    it('marks session as loaded', () => {
      useChatStore.getState().setSessionLoaded('s1', true)
      expect(useChatStore.getState().isSessionLoaded('s1')).toBe(true)
    })

    it('clears session cache', () => {
      useChatStore
        .getState()
        .setCachedMessages('s1', [
          { id: 'm1', sessionId: 's1', role: 'user', content: 'hi', createdAt: '' },
        ])
      useChatStore.getState().clearSessionCache('s1')

      expect(useChatStore.getState().getCachedMessages('s1')).toBeUndefined()
    })

    it('preserves messages when marking loaded', () => {
      const messages: Message[] = [
        { id: 'm1', sessionId: 's1', role: 'user', content: 'hi', createdAt: '' },
      ]
      useChatStore.getState().setCachedMessages('s1', messages)
      useChatStore.getState().setSessionLoaded('s1', true)

      expect(useChatStore.getState().getCachedMessages('s1')).toEqual(messages)
      expect(useChatStore.getState().isSessionLoaded('s1')).toBe(true)
    })
  })
})
