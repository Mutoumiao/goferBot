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
  isTemp?: boolean
}

export interface RouteInfo {
  pathname: string
  params: Record<string, string>
  tabMeta?: RouteMeta | null
}

interface TabsState {
  tabs: Tab[]
  activeTabId: string

  activeTab: () => Tab | null

  /** 根据路由信息同步标签（路由驱动入口） */
  syncRoute: (routeInfo: RouteInfo) => Tab | null
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

      syncRoute: (routeInfo): Tab | null => {
        const { tabs, activeTabId } = get()
        const { pathname, params, tabMeta } = routeInfo

        // 没有 tabMeta 的路由不创建标签（如登录页、404等）
        if (!tabMeta) return null

        const sessionId = params.sessionId

        // 单例页面：若已存在同 route 的标签则激活，不新建
        if (tabMeta.singleton) {
          const existing = tabs.find((t) => t.route === pathname)
          if (existing) {
            if (existing.id !== activeTabId) {
              set({ activeTabId: existing.id })
            }
            return null
          }
        }

        // 如果当前活跃标签是临时标签，且新路由是真实会话路由，则更新而非创建
        const activeTab = tabs.find((t) => t.id === activeTabId)
        if (activeTab?.isTemp && sessionId && !sessionId.startsWith('temp_')) {
          // 检查当前活跃标签的路由是否是 chat 临时路由
          const isChatTempRoute = activeTab.route.match(/^\/chat\/temp_/)
          if (isChatTempRoute) {
            set({
              tabs: tabs.map((t) =>
                t.id === activeTabId
                  ? { ...t, route: pathname, isTemp: false, sessionId }
                  : t,
              ),
            })
            return null
          }
        }

        // 多实例页面（如 chat session）：根据 params 中的标识符查找
        if (sessionId) {
          const existing = tabs.find((t) => t.sessionId === sessionId)
          if (existing) {
            // 如果路由路径变了（比如参数顺序不同），更新 route
            if (existing.route !== pathname) {
              set({
                tabs: tabs.map((t) =>
                  t.id === existing.id ? { ...t, route: pathname } : t,
                ),
                activeTabId: existing.id,
              })
            } else if (existing.id !== activeTabId) {
              set({ activeTabId: existing.id })
            }
            return null
          }
        }

        // 清理过期的临时标签：如果新路由是真实会话，且存在对应的临时标签，移除临时标签
        const cleanedTabs = sessionId && !sessionId.startsWith('temp_')
          ? tabs.filter((t) => !(t.isTemp && t.route.startsWith('/chat/temp_')))
          : tabs

        // 创建新标签
        const tab: Tab = {
          id: crypto.randomUUID(),
          route: pathname,
          title: tabMeta.title,
          closable: tabMeta.closable,
          sessionId,
          isDirty: false,
          isTemp: sessionId ? sessionId.startsWith('temp_') : false,
        }
        set({ tabs: [...cleanedTabs, tab], activeTabId: tab.id })
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
