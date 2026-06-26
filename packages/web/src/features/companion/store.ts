/**
 * Companion 模块 Zustand 状态管理。
 *
 * 职责边界：
 * - 只保存 companion 模块的 UI 状态与本地缓存（伴侣列表、当前选中、会话列表等）
 * - 不直接发起 API 请求；所有异步操作放在 services.ts 中编排
 * - 为 Task 13 预留会话管理字段
 */
import { create } from 'zustand'
import type {
  Companion,
  Conversation,
} from './types'

export interface CompanionState {
  // 伴侣列表
  companions: Companion[]
  isLoading: boolean
  error: string | null

  // 当前选中伴侣
  selectedCompanionId: string | null

  // 会话管理（为 Task 13 预留）
  currentConversation: Conversation | null
  conversations: Conversation[]
  isLoadingConversation: boolean

  // Actions
  setCompanions: (companions: Companion[]) => void
  addCompanion: (companion: Companion) => void
  removeCompanion: (id: string) => void
  updateCompanion: (id: string, updates: Partial<Companion>) => void
  setIsLoading: (v: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void

  selectCompanion: (id: string | null) => void

  // 会话 Actions（为 Task 13 预留）
  setConversations: (conversations: Conversation[]) => void
  addConversation: (conversation: Conversation) => void
  setCurrentConversation: (conversation: Conversation | null) => void
  setIsLoadingConversation: (v: boolean) => void
}

export const useCompanionStore = create<CompanionState>((set) => ({
  companions: [],
  isLoading: false,
  error: null,

  selectedCompanionId: null,

  currentConversation: null,
  conversations: [],
  isLoadingConversation: false,

  setCompanions: (companions) => set({ companions }),
  addCompanion: (companion) =>
    set((s) => ({ companions: [...s.companions, companion] })),
  removeCompanion: (id) =>
    set((s) => ({
      companions: s.companions.filter((c) => c.id !== id),
      selectedCompanionId:
        s.selectedCompanionId === id ? null : s.selectedCompanionId,
    })),
  updateCompanion: (id, updates) =>
    set((s) => ({
      companions: s.companions.map((c) =>
        c.id === id ? { ...c, ...updates } : c,
      ),
    })),
  setIsLoading: (v) => set({ isLoading: v }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  selectCompanion: (id) => set({ selectedCompanionId: id }),

  setConversations: (conversations) => set({ conversations }),
  addConversation: (conversation) =>
    set((s) => ({ conversations: [...s.conversations, conversation] })),
  setCurrentConversation: (conversation) =>
    set({ currentConversation: conversation }),
  setIsLoadingConversation: (v) => set({ isLoadingConversation: v }),
}))
