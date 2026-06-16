import { create } from 'zustand'
import { persist, devtools, createJSONStorage } from 'zustand/middleware'
import type { TabRouteKey } from '@/router-register'

export type TabType = TabRouteKey

export interface Tab {
  id: string
  type: TabType
  title: string
  conversationId?: string
  createdAt: number
  closable: boolean
}

interface WorkspaceState {
  tabs: Tab[]
  activeTabId: string
}

export type RemoveTabResult =
  | { removed: false }
  | { removed: true; nextTab: Tab | null }

interface WorkspaceActions {
  activeTab: () => Tab | null
  addTab: (partial: Omit<Tab, 'id' | 'createdAt'> & { id?: string }) => Tab
  removeTab: (tabId: string) => RemoveTabResult
  switchTab: (tabId: string) => boolean
  renameTab: (tabId: string, title: string) => void
  updateTab: (tabId: string, updates: Partial<Omit<Tab, 'id'>>) => void
  findTabByConversationId: (conversationId: string) => Tab | null
  findTabByType: (type: TabType) => Tab | null
  reset: () => void
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions

function generateTabId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// 清理旧架构遗留的 sessionStorage key
if (typeof sessionStorage !== 'undefined') {
  try {
    sessionStorage.removeItem('tempSessionIds')
  } catch {
    // ignore
  }
}

export function migrateWorkspaceState(persistedState: unknown, version: number): WorkspaceState {
  const state = persistedState as WorkspaceState | undefined
  if (version === 0 && state?.tabs) {
    state.tabs = state.tabs.map((t) =>
      t.type === 'chat' ? { ...t, closable: true } : t,
    )
  }
  return state as WorkspaceState
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  devtools(
    persist(
      (set, get) => ({
        tabs: [],
        activeTabId: '',

        activeTab: () => {
          const { tabs, activeTabId } = get()
          return tabs.find((t) => t.id === activeTabId) ?? null
        },

        addTab: (partial) => {
          const tab: Tab = {
            id: partial.id ?? generateTabId(),
            type: partial.type,
            title: partial.title,
            conversationId: partial.conversationId,
            closable: partial.closable ?? true,
            createdAt: Date.now(),
          }
          set((state) => ({
            tabs: [...state.tabs, tab],
            activeTabId: tab.id,
          }))
          return tab
        },

        removeTab: (tabId): RemoveTabResult => {
          const { tabs, activeTabId } = get()
          const target = tabs.find((t) => t.id === tabId)
          if (!target || !target.closable) {
            return { removed: false }
          }

          const newTabs = tabs.filter((t) => t.id !== tabId)
          let newActiveId = activeTabId

          if (activeTabId === tabId) {
            const removedIndex = tabs.findIndex((t) => t.id === tabId)
            const leftIndex = Math.max(0, removedIndex - 1)
            newActiveId = newTabs[Math.min(leftIndex, newTabs.length - 1)]?.id ?? ''
          }

          set({ tabs: newTabs, activeTabId: newActiveId })
          const nextTab = newTabs.find((t) => t.id === newActiveId) ?? null
          return { removed: true, nextTab }
        },

        switchTab: (tabId) => {
          const exists = get().tabs.some((t) => t.id === tabId)
          if (!exists) return false
          set({ activeTabId: tabId })
          return true
        },

        renameTab: (tabId, title) => {
          set((state) => ({
            tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, title } : t)),
          }))
        },

        updateTab: (tabId, updates) => {
          set((state) => ({
            tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, ...updates } : t)),
          }))
        },

        findTabByConversationId: (conversationId) => {
          return get().tabs.find((t) => t.conversationId === conversationId) ?? null
        },

        findTabByType: (type) => {
          return get().tabs.find((t) => t.type === type) ?? null
        },

        reset: () => {
          set({ tabs: [], activeTabId: '' })
        },
      }),
      {
        name: 'gofer-workspace-v1',
        version: 1,
        migrate: migrateWorkspaceState,
        partialize: (state) => ({ tabs: state.tabs, activeTabId: state.activeTabId }),
        storage: createJSONStorage(() => sessionStorage),
      },
    ),
    { name: 'WorkspaceStore', enabled: import.meta.env?.DEV ?? true },
  ),
)

declare global {
  interface Window {
    __workspace?: typeof useWorkspaceStore
  }
}

if (typeof window !== 'undefined') {
  window.__workspace = useWorkspaceStore
}
