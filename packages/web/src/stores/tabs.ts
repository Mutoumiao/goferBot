import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RouteMeta } from '@/router-register'

export interface Tab {
  id: string
  route: string
  title: string
  closable: boolean
  sessionId?: string
  isDirty: boolean
}

interface TabsState {
  tabs: Tab[]
  activeTabId: string

  activeTab: () => Tab | null

  /** 通过路由添加/激活标签（自动处理单页面复用） */
  openRoute: (route: string, meta: RouteMeta, sessionId?: string) => Tab | null
  /** 移除标签 */
  removeTab: (tabId: string) => string | null
  /** 激活标签 */
  activateTab: (tabId: string) => void
  /** 关闭所有可关闭标签 */
  closeAllTabs: () => void
  /** 关闭其他标签 */
  closeOtherTabs: (tabId: string) => void
  /** 重命名标签 */
  renameTab: (tabId: string, title: string) => void
  /** 更新活跃标签会话 */
  updateActiveTabSession: (sessionId: string, title: string) => void
  /** 设置标签脏状态 */
  setTabDirty: (tabId: string, isDirty: boolean) => void
  /** 根据路由查找标签 */
  findTabByRoute: (route: string) => Tab | null
}

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: '',

      activeTab: (): Tab | null => {
        const { tabs, activeTabId } = get()
        return tabs.find((t) => t.id === activeTabId) ?? null
      },

      openRoute: (route, meta, sessionId): Tab | null => {
        const { tabs } = get()

        // 单页面标签：若已存在同 route 的标签则激活，不新建
        if (meta.singleton) {
          const existing = tabs.find((t) => t.route === route)
          if (existing) {
            set({ activeTabId: existing.id })
            return null
          }
        }

        // 多页面标签（chat-session）：若同一 sessionId 已存在则激活
        if (sessionId) {
          const existing = tabs.find((t) => t.sessionId === sessionId)
          if (existing) {
            set({ activeTabId: existing.id })
            return null
          }
        }

        const tab: Tab = {
          id: crypto.randomUUID(),
          route,
          title: meta.title,
          closable: meta.closable,
          sessionId,
          isDirty: false,
        }
        set({ tabs: [...tabs, tab], activeTabId: tab.id })
        return tab
      },

      removeTab: (tabId): string | null => {
        const { tabs, activeTabId } = get()
        const target = tabs.find((t) => t.id === tabId)
        if (!target || !target.closable) return null

        const newTabs = tabs.filter((t) => t.id !== tabId)
        if (newTabs.length === 0) {
          set({ tabs: [], activeTabId: '' })
          return null
        }

        let newActiveId: string | null = null
        if (activeTabId === tabId) {
          const removedIndex = tabs.findIndex((t) => t.id === tabId)
          const leftIndex = Math.max(0, removedIndex - 1)
          newActiveId = newTabs[Math.min(leftIndex, newTabs.length - 1)]?.id ?? null
        }

        set({ tabs: newTabs, activeTabId: newActiveId ?? activeTabId })
        return newActiveId
      },

      activateTab: (tabId) => {
        const exists = get().tabs.some((t) => t.id === tabId)
        if (exists) set({ activeTabId: tabId })
      },

      closeAllTabs: () => {
        set({ tabs: [], activeTabId: '' })
      },

      closeOtherTabs: (tabId) => {
        const { tabs } = get()
        if (!tabs.some((t) => t.id === tabId && t.closable)) return
        const kept = tabs.filter((t) => t.id === tabId)
        set({ tabs: kept, activeTabId: tabId })
      },

      renameTab: (tabId, title) => {
        set({
          tabs: get().tabs.map((t) => (t.id === tabId ? { ...t, title } : t)),
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

      findTabByRoute: (route) => {
        const { tabs } = get()
        return tabs.find((t) => t.route === route) ?? null
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
          // 确保 activeTabId 指向存在的标签
          const exists = state.tabs.some((t) => t.id === state.activeTabId)
          if (!exists) {
            state.activeTabId = state.tabs[0]?.id ?? ''
          }
        }
      },
    },
  ),
)
