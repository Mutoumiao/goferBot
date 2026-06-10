import { create } from 'zustand'
import type { Message, Session } from '@goferbot/data'

interface ChatState {
  activeSession: Session | null
  messages: Message[]
  isLoadingHistory: boolean
  isStreaming: boolean
  streamingContent: string
  sessions: Session[]
  isLoadingSessions: boolean
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
  setIsLoadingSessions: (v: boolean) => void
  setError: (error: string | null) => void
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
  setIsLoadingSessions: (v) => set({ isLoadingSessions: v }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}))
