import type { Message, ProviderListItem, Session } from '@goferbot/data'
import { create } from 'zustand'
import { useSettingsStore } from '@/stores/settings'

interface ChatState {
  activeSession: Session | null
  messages: Message[]
  isLoadingHistory: boolean
  isStreaming: boolean
  streamingContent: string
  sessions: Session[]
  isLoadingSessions: boolean
  error: string | null

  // 初始化相关：可用 providers / 当前选中的 provider
  availableProviders: ProviderListItem[]
  selectedProviderKey: string | null
  isInitLoading: boolean
  initError: string | null

  // 按会话缓存的消息和加载状态，实现标签页切换不重新加载
  sessionCache: Map<string, { messages: Message[]; loaded: boolean }>

  setActiveSession: (session: Session | null) => void
  setMessages: (messages: Message[]) => void
  appendMessage: (message: Message) => void
  setIsLoadingHistory: (v: boolean) => void
  setIsStreaming: (v: boolean) => void
  appendStreamContent: (chunk: string) => void
  flushStreamContent: () => void
  clearChat: () => void

  setSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void
  removeSession: (id: string) => void
  updateSession: (id: string, updates: Partial<Session>) => void
  setIsLoadingSessions: (v: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void

  setAvailableProviders: (providers: ProviderListItem[]) => void
  setSelectedProviderKey: (key: string | null) => void
  setIsInitLoading: (v: boolean) => void
  setInitError: (error: string | null) => void

  // 会话缓存操作
  getCachedMessages: (sessionId: string) => Message[] | undefined
  setCachedMessages: (sessionId: string, messages: Message[]) => void
  clearSessionCache: (sessionId: string) => void
  isSessionLoaded: (sessionId: string) => boolean
  setSessionLoaded: (sessionId: string, loaded: boolean) => void
}

/** 根据用户设置和 providers 列表选择默认 provider */
function pickDefaultProviderKey(providers: ProviderListItem[]): string | null {
  if (providers.length === 0) return null
  try {
    const defaultKey = useSettingsStore.getState().config.defaultChatProvider
    if (defaultKey && providers.some((p) => p.key === defaultKey)) {
      return defaultKey
    }
  } catch {
    // settings 可能尚未初始化，忽略
  }
  return providers[0].key
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeSession: null,
  messages: [],
  isLoadingHistory: false,
  isStreaming: false,
  streamingContent: '',
  sessions: [],
  isLoadingSessions: false,
  error: null,

  availableProviders: [],
  selectedProviderKey: null,
  isInitLoading: false,
  initError: null,

  sessionCache: new Map<string, { messages: Message[]; loaded: boolean }>(),

  setActiveSession: (session) => set({ activeSession: session }),
  setMessages: (messages) => set({ messages }),
  appendMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setIsLoadingHistory: (v) => set({ isLoadingHistory: v }),
  setIsStreaming: (v) => set({ isStreaming: v }),
  appendStreamContent: (chunk) => set((s) => ({ streamingContent: s.streamingContent + chunk })),
  flushStreamContent: () =>
    set((s) => {
      if (!s.streamingContent) return s
      const assistantMsg: Message = {
        id: `msg-${Date.now()}`,
        sessionId: s.activeSession?.id ?? '',
        role: 'assistant',
        content: s.streamingContent,
        createdAt: new Date().toISOString(),
      }
      return {
        messages: [...s.messages, assistantMsg],
        streamingContent: '',
      }
    }),
  clearChat: () =>
    set({
      activeSession: null,
      messages: [],
      sessions: [],
      streamingContent: '',
      isStreaming: false,
      isLoadingSessions: false,
      error: null,
    }),

  setSessions: (sessions) => set({ sessions }),
  addSession: (session) => set((s) => ({ sessions: [session, ...s.sessions] })),
  removeSession: (id) =>
    set((s) => ({
      sessions: s.sessions.filter((ses) => ses.id !== id),
    })),
  updateSession: (id, updates) =>
    set((s) => ({
      sessions: s.sessions.map((ses) => (ses.id === id ? { ...ses, ...updates } : ses)),
    })),
  setIsLoadingSessions: (v) => set({ isLoadingSessions: v }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  setAvailableProviders: (providers) => {
    const current = get()
    const selectedKey =
      current.selectedProviderKey && providers.some((p) => p.key === current.selectedProviderKey)
        ? current.selectedProviderKey
        : pickDefaultProviderKey(providers)
    set({ availableProviders: providers, selectedProviderKey: selectedKey })
  },
  setSelectedProviderKey: (key) => set({ selectedProviderKey: key }),
  setIsInitLoading: (v) => set({ isInitLoading: v }),
  setInitError: (error) => set({ initError: error }),

  getCachedMessages: (sessionId) => {
    return get().sessionCache.get(sessionId)?.messages
  },
  setCachedMessages: (sessionId, messages) => {
    set((s) => {
      const cache = new Map(s.sessionCache)
      const existing = cache.get(sessionId)
      cache.set(sessionId, { messages, loaded: existing?.loaded ?? false })
      return { sessionCache: cache }
    })
  },
  clearSessionCache: (sessionId) => {
    set((s) => {
      const cache = new Map(s.sessionCache)
      cache.delete(sessionId)
      return { sessionCache: cache }
    })
  },
  isSessionLoaded: (sessionId) => {
    return get().sessionCache.get(sessionId)?.loaded ?? false
  },
  setSessionLoaded: (sessionId, loaded) => {
    set((s) => {
      const cache = new Map(s.sessionCache)
      const existing = cache.get(sessionId)
      cache.set(sessionId, { messages: existing?.messages ?? [], loaded })
      return { sessionCache: cache }
    })
  },
}))
