import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Tab {
  id: string
  type: string
  title: string
  route?: string
  icon?: string
  sessionId?: string
  isDirty: boolean
  closable: boolean
}

const HOME_TAB: Tab = {
  id: 'home',
  type: 'chat',
  title: '首页',
  isDirty: false,
  closable: false,
}

interface TabsState {
  tabs: Tab[]
  activeTabId: string

  activeTab: () => Tab | null

  addTab: (type: string, sessionId?: string, title?: string, route?: string) => Tab
  addTabByRoute: (route: string, defaultTitle: string, type: string) => Tab | null
  removeTab: (tabId: string) => void
  activateTab: (tabId: string) => void
  closeAllTabs: () => void
  closeOtherTabs: (tabId: string) => void
  renameTab: (tabId: string, title: string) => void
  updateHomeTabSession: (sessionId: string, title: string) => void
  updateActiveTabSession: (sessionId: string, title: string) => void
  setTabDirty: (tabId: string, isDirty: boolean) => void
}

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs: [{ ...HOME_TAB }],
      activeTabId: 'home',

      activeTab: (): Tab | null => {
        const { tabs, activeTabId } = get()
        return tabs.find((t) => t.id === activeTabId) ?? null
      },

      addTab: (type, sessionId, title, route): Tab => {
        const tab: Tab = {
          id: crypto.randomUUID(),
          type,
          title: title || type,
          route,
          sessionId,
          isDirty: false,
          closable: true,
        }
        set({ tabs: [...get().tabs, tab], activeTabId: tab.id })
        return tab
      },

      addTabByRoute: (route, defaultTitle, type): Tab | null => {
        if (!route) return null
        const { tabs } = get()
        const existing = tabs.find((t) => t.route === route)
        if (existing) {
          set({ activeTabId: existing.id })
          return null
        }
        return get().addTab(type, undefined, defaultTitle, route)
      },

      removeTab: (tabId) => {
        const { tabs, activeTabId } = get()
        const target = tabs.find((t) => t.id === tabId)
        if (!target || !target.closable) return

        const newTabs = tabs.filter((t) => t.id !== tabId)
        if (newTabs.length === 0) {
          // 安全阀：所有标签被关闭时重建 home
          set({ tabs: [{ ...HOME_TAB }], activeTabId: 'home' })
          return
        }

        let newActiveId = activeTabId
        if (activeTabId === tabId) {
          // 激活左侧相邻
          const removedIndex = tabs.findIndex((t) => t.id === tabId)
          const leftIndex = Math.max(0, removedIndex - 1)
          newActiveId = newTabs[Math.min(leftIndex, newTabs.length - 1)]?.id ?? 'home'
        }

        set({ tabs: newTabs, activeTabId: newActiveId })
      },

      activateTab: (tabId) => {
        const exists = get().tabs.some((t) => t.id === tabId)
        if (exists) set({ activeTabId: tabId })
      },

      closeAllTabs: () => {
        set({ tabs: [{ ...HOME_TAB }], activeTabId: 'home' })
      },

      closeOtherTabs: (tabId) => {
        const { tabs } = get()
        if (!tabs.some((t) => t.id === tabId && t.closable)) return
        const kept = tabs.filter((t) => t.id === tabId || t.id === 'home')
        set({ tabs: kept, activeTabId: tabId })
      },

      renameTab: (tabId, title) => {
        set({
          tabs: get().tabs.map((t) => (t.id === tabId ? { ...t, title } : t)),
        })
      },

      updateHomeTabSession: (sessionId, title) => {
        set({
          tabs: get().tabs.map((t) =>
            t.id === 'home' ? { ...t, sessionId, title } : t,
          ),
        })
      },

      updateActiveTabSession: (sessionId, title) => {
        const { activeTabId } = get()
        set({
          tabs: get().tabs.map((t) =>
            t.id === activeTabId ? { ...t, sessionId, title, isDirty: false } : t,
          ),
        })
      },

      setTabDirty: (tabId, isDirty) => {
        set({
          tabs: get().tabs.map((t) => (t.id === tabId ? { ...t, isDirty } : t)),
        })
      },
    }),
    {
      name: 'goferbot-tabs',
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (!state) return
          // 1. 确保 home 标签存在
          const hasHome = state.tabs.some((t) => t.id === 'home')
          if (!hasHome) {
            state.tabs.unshift({ ...HOME_TAB })
          }
          // 2. home 标签 closable 强制设为 false
          state.tabs = state.tabs.map((t) =>
            t.id === 'home' ? { ...t, closable: false } : t,
          )
          // 3. 确保 activeTabId 指向存在的标签
          const exists = state.tabs.some((t) => t.id === state.activeTabId)
          if (!exists) {
            state.activeTabId = 'home'
          }
        }
      },
    },
  ),
)
