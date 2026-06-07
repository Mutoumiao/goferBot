import { create } from 'zustand'
import type { Message, Session } from '@goferbot/data'

interface ChatState {
  /** 当前活跃 session */
  activeSession: Session | null
  /** 当前 session 的消息列表 */
  messages: Message[]
  /** 加载状态 */
  isLoadingHistory: boolean
  /** SSE 流式接收中 */
  isStreaming: boolean
  /** SSE 流式接收的临时内容 */
  streamingContent: string

  setActiveSession: (session: Session | null) => void
  setMessages: (messages: Message[]) => void
  appendMessage: (message: Message) => void
  setIsLoadingHistory: (v: boolean) => void
  setIsStreaming: (v: boolean) => void
  appendStreamContent: (chunk: string) => void
  flushStreamContent: () => void
  clearChat: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  activeSession: null,
  messages: [],
  isLoadingHistory: false,
  isStreaming: false,
  streamingContent: '',

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
      streamingContent: '',
      isStreaming: false,
    }),
}))
