import { create } from 'zustand'
import type { Message, Session } from '@goferbot/data'
import { getSessions, createSession as apiCreateSession, deleteSession as apiDeleteSession, renameSession as apiRenameSession } from '@/api/chat'

interface ChatState {
  /** 当前活跃 session */
  activeSession: Session | null
  /** 当前 session 的消息列表 */
  messages: Message[]
  /** 加载历史消息状态 */
  isLoadingHistory: boolean
  /** SSE 流式接收中 */
  isStreaming: boolean
  /** SSE 流式接收的临时内容 */
  streamingContent: string
  /** 会话列表 */
  sessions: Session[]
  /** 加载会话列表状态 */
  isLoadingSessions: boolean
  /** 操作错误信息 */
  error: string | null

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
  loadSessions: () => Promise<void>
  createSession: () => Promise<Session | undefined>
  renameSession: (id: string, title: string) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  sendMessage: (content: string, knowledgeBaseIds?: string[]) => Promise<void>
  clearError: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  activeSession: null,
  messages: [],
  isLoadingHistory: false,
  isStreaming: false,
  streamingContent: '',
  sessions: [],
  isLoadingSessions: false,
  error: null,

  setActiveSession: (session) => set({ activeSession: session }),
  setMessages: (messages) => set({ messages }),
  appendMessage: (message) =>
    set((s) => ({ messages: [...s.messages, message] })),
  setIsLoadingHistory: (v) => set({ isLoadingHistory: v }),
  setIsStreaming: (v) => set({ isStreaming: v }),
  appendStreamContent: (chunk) =>
    set((s) => ({ streamingContent: s.streamingContent + chunk })),
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

  // ---- 新增 actions ----
  setSessions: (sessions) => set({ sessions }),
  addSession: (session) => set((s) => ({ sessions: [session, ...s.sessions] })),
  removeSession: (id) =>
    set((s) => ({
      sessions: s.sessions.filter((ses) => ses.id !== id),
    })),
  updateSession: (id, updates) =>
    set((s) => ({
      sessions: s.sessions.map((ses) =>
        ses.id === id ? { ...ses, ...updates } : ses,
      ),
    })),

  loadSessions: async () => {
    set({ isLoadingSessions: true, error: null })
    try {
      const res = await getSessions().send()
      set({ sessions: res.sessions ?? [], isLoadingSessions: false })
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : '加载会话列表失败',
        isLoadingSessions: false,
      })
    }
  },

  createSession: async () => {
    set({ isLoadingSessions: true, error: null })
    try {
      const newSession = await apiCreateSession().send()
      set((s) => ({
        sessions: [newSession, ...s.sessions],
        activeSession: newSession,
        isLoadingSessions: false,
      }))
      return newSession
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : '创建会话失败',
        isLoadingSessions: false,
      })
      return undefined
    }
  },

  renameSession: async (id, title) => {
    if (!title.trim()) return
    set({ isLoadingSessions: true, error: null })
    try {
      await apiRenameSession(id, title).send()
      set((s) => ({
        sessions: s.sessions.map((ses) =>
          ses.id === id ? { ...ses, title } : ses,
        ),
        isLoadingSessions: false,
      }))
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : '重命名失败',
        isLoadingSessions: false,
      })
    }
  },

  deleteSession: async (id) => {
    set({ isLoadingSessions: true, error: null })
    try {
      await apiDeleteSession(id).send()
      set((s) => ({
        sessions: s.sessions.filter((ses) => ses.id !== id),
        activeSession: s.activeSession?.id === id ? null : s.activeSession,
        isLoadingSessions: false,
      }))
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : '删除会话失败',
        isLoadingSessions: false,
      })
    }
  },

  sendMessage: async (_content, _knowledgeBaseIds) => {
    // 骨架：具体 SSE 逻辑由 f-44 实现
  },

  clearError: () => set({ error: null }),
}))
