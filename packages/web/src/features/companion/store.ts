/**
 * Companion 模块 Zustand 状态管理。
 *
 * 职责边界：
 * - 只保存 companion 模块的 UI 状态与本地缓存
 * - 不直接发起 API 请求；所有异步操作放在 services.ts 中编排
 */
import { create } from 'zustand'
import type { Companion, CompanionMessage, Conversation } from './types'

export interface CompanionState {
  companions: Companion[]
  isLoading: boolean
  error: string | null

  selectedCompanionId: string | null

  currentConversationId: string | null
  currentConversation: Conversation | null
  conversations: Conversation[]
  isLoadingConversation: boolean

  messages: CompanionMessage[]
  isLoadingHistory: boolean
  isStreaming: boolean
  streamingContent: string
  streamingMessageId: string | null
  hasMore: boolean
  cursor: string | null

  setCompanions: (companions: Companion[]) => void
  addCompanion: (companion: Companion) => void
  upsertCompanion: (companion: Companion) => void
  removeCompanion: (id: string) => void
  updateCompanion: (id: string, updates: Partial<Companion>) => void
  setIsLoading: (v: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void

  selectCompanion: (id: string | null) => void

  setConversations: (conversations: Conversation[]) => void
  addConversation: (conversation: Conversation) => void
  setCurrentConversation: (conversation: Conversation | null) => void
  setIsLoadingConversation: (v: boolean) => void

  setMessages: (messages: CompanionMessage[]) => void
  prependMessages: (messages: CompanionMessage[]) => void
  addMessage: (message: CompanionMessage) => void
  updateMessage: (id: string, updates: Partial<CompanionMessage>) => void
  removeMessage: (id: string) => void
  setIsLoadingHistory: (v: boolean) => void
  setIsStreaming: (v: boolean) => void
  setStreamingContent: (content: string) => void
  appendStreamingChunk: (chunk: string) => void
  setStreamingMessageId: (id: string | null) => void
  setHasMore: (v: boolean) => void
  setCursor: (cursor: string | null) => void
  resetStreaming: () => void
  resetConversationState: () => void
}

export const useCompanionStore = create<CompanionState>((set) => ({
  companions: [],
  isLoading: false,
  error: null,

  selectedCompanionId: null,

  currentConversationId: null,
  currentConversation: null,
  conversations: [],
  isLoadingConversation: false,

  messages: [],
  isLoadingHistory: false,
  isStreaming: false,
  streamingContent: '',
  streamingMessageId: null,
  hasMore: false,
  cursor: null,

  setCompanions: (companions) => set({ companions }),
  addCompanion: (companion) => set((s) => ({ companions: [...s.companions, companion] })),
  upsertCompanion: (companion) =>
    set((s) => ({
      companions: s.companions.some((c) => c.id === companion.id)
        ? s.companions.map((c) => (c.id === companion.id ? companion : c))
        : [...s.companions, companion],
    })),
  removeCompanion: (id) =>
    set((s) => ({
      companions: s.companions.filter((c) => c.id !== id),
      selectedCompanionId: s.selectedCompanionId === id ? null : s.selectedCompanionId,
    })),
  updateCompanion: (id, updates) =>
    set((s) => ({
      companions: s.companions.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
  setIsLoading: (v) => set({ isLoading: v }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  selectCompanion: (id) => set({ selectedCompanionId: id }),

  setConversations: (conversations) => set({ conversations }),
  addConversation: (conversation) =>
    set((s) => ({ conversations: [...s.conversations, conversation] })),
  setCurrentConversation: (conversation) =>
    set({
      currentConversation: conversation,
      currentConversationId: conversation?.id ?? null,
    }),
  setIsLoadingConversation: (v) => set({ isLoadingConversation: v }),

  setMessages: (messages) => set({ messages }),
  prependMessages: (messages) => set((s) => ({ messages: [...messages, ...s.messages] })),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  updateMessage: (id, updates) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),
  removeMessage: (id) =>
    set((s) => ({
      messages: s.messages.filter((m) => m.id !== id),
    })),
  setIsLoadingHistory: (v) => set({ isLoadingHistory: v }),
  setIsStreaming: (v) => set({ isStreaming: v }),
  setStreamingContent: (content) => set({ streamingContent: content }),
  appendStreamingChunk: (chunk) => set((s) => ({ streamingContent: s.streamingContent + chunk })),
  setStreamingMessageId: (id) => set({ streamingMessageId: id }),
  setHasMore: (v) => set({ hasMore: v }),
  setCursor: (cursor) => set({ cursor }),
  resetStreaming: () =>
    set({
      isStreaming: false,
      streamingContent: '',
      streamingMessageId: null,
    }),
  resetConversationState: () =>
    set({
      currentConversationId: null,
      currentConversation: null,
      messages: [],
      isLoadingHistory: false,
      isStreaming: false,
      streamingContent: '',
      streamingMessageId: null,
      hasMore: false,
      cursor: null,
    }),
}))
