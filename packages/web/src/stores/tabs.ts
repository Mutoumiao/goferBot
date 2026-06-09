import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TabType = 'chat' | 'chat-session' | 'kb' | 'history' | 'settings' | 'recycle-bin'

export interface Tab {
  id: string
  type: TabType
  title: string
  route: string
  sessionId?: string
  isDirty: boolean
  closable: boolean
}

const HOME_TAB: Tab = {
  id: 'home',
  type: 'chat',
  title: '问答首页',
  route: '/app/chat',
  isDirty: false,
  closable: false,
}

/** 单页面标签（singleton）— 同一类型只存在一个标签 */
const SINGLETON_TYPES: TabType[] = ['chat', 'kb', 'history', 'settings', 'recycle-bin']

/** 路由 → 标签类型映射 */
const ROUTE_TYPE_MAP: Record<string, TabType> = {
  '/app': 'chat',
  '/app/chat': 'chat',
  '/app/kb': 'kb',
  '/app/history': 'history',
  '/app/settings': 'settings',
  '/app/recycle-bin': 'recycle-bin',
}

/** 标签类型 → 默认标题映射 */
const TYPE_TITLE_MAP: Record<TabType, string> = {
  chat: '问答首页',
  'chat-session': '新对话',
  kb: '知识库',
  history: '会话管理',
  settings: '设置',
  'recycle-bin': '回收站',
}

interface TabsState {
  tabs: Tab[]
  activeTabId: string

  activeTab: () => Tab | null

  /** 添加标签（自动处理单页面复用） */
  addTab: (type: TabType, sessionId?: string, title?: string, route?: string) => Tab | null
  /** 通过路由添加/激活标签 */
  addTabByRoute: (route: string, title?: string, sessionId?: string) => Tab | null
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
  /** 更新首页标签会话 */
  updateHomeTabSession: (sessionId: string, title: string) => void
  /** 更新活跃标签会话 */
  updateActiveTabSession: (sessionId: string, title: string) => void
  /** 设置标签脏状态 */
  setTabDirty: (tabId: string, isDirty: boolean) => void
  /** 根据路由查找标签 */
  findTabByRoute: (route: string) => Tab | null
}

function getRouteFromType(type: TabType, sessionId?: string): string {
  if (type === 'chat-session' && sessionId) {
    return `/app/chat?session=${sessionId}`
  }
  const routeMap: Record<TabType, string> = {
    chat: '/app/chat',
    'chat-session': '/app/chat',
    kb: '/app/kb',
    history: '/app/history',
    settings: '/app/settings',
    'recycle-bin': '/app/recycle-bin',
  }
  return routeMap[type]
}

function getTypeFromRoute(route: string): TabType {
  // 处理带 query 的路由
  const path = route.split('?')[0]
  const search = route.includes('?') ? route.split('?')[1] : ''
  const params = new URLSearchParams(search)

  // 带 session 参数的 chat 路由是多页面标签
  if (path === '/app/chat' && params.has('session')) {
    return 'chat-session'
  }

  return ROUTE_TYPE_MAP[path] ?? 'chat'
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

      addTab: (type, sessionId, title, route): Tab | null => {
        const { tabs } = get()

        // 单页面标签：若已存在则激活，不新建
        if (SINGLETON_TYPES.includes(type)) {
          const existing = tabs.find((t) => t.type === type)
          if (existing) {
            set({ activeTabId: existing.id })
            return null
          }
        }

        // 多页面标签（chat-session）：若同一 sessionId 已存在则激活
        if (type === 'chat-session') {
          if (!sessionId) {
            // chat-session 必须有 sessionId，否则降级为 chat 首页
            const existing = tabs.find((t) => t.type === 'chat')
            if (existing) {
              set({ activeTabId: existing.id })
              return null
            }
            // 创建 chat 首页标签
            const homeTab: Tab = {
              id: crypto.randomUUID(),
              type: 'chat',
              title: title || TYPE_TITLE_MAP['chat'],
              route: route || '/app/chat',
              isDirty: false,
              closable: false,
            }
            set({ tabs: [...tabs, homeTab], activeTabId: homeTab.id })
            return homeTab
          }
          const existing = tabs.find((t) => t.type === 'chat-session' && t.sessionId === sessionId)
          if (existing) {
            set({ activeTabId: existing.id })
            return null
          }
        }

        const tabRoute = route || getRouteFromType(type, sessionId)
        const tab: Tab = {
          id: crypto.randomUUID(),
          type,
          title: title || TYPE_TITLE_MAP[type],
          route: tabRoute,
          sessionId,
          isDirty: false,
          closable: type !== 'chat',
        }
        set({ tabs: [...tabs, tab], activeTabId: tab.id })
        return tab
      },

      addTabByRoute: (route, title, sessionId): Tab | null => {
        const type = getTypeFromRoute(route)
        return get().addTab(type, sessionId, title, route)
      },

      removeTab: (tabId): string | null => {
        const { tabs, activeTabId } = get()
        const target = tabs.find((t) => t.id === tabId)
        if (!target || !target.closable) return null

        const newTabs = tabs.filter((t) => t.id !== tabId)
        if (newTabs.length === 0) {
          set({ tabs: [{ ...HOME_TAB }], activeTabId: 'home' })
          return 'home'
        }

        let newActiveId = activeTabId
        if (activeTabId === tabId) {
          // 激活左侧相邻标签
          const removedIndex = tabs.findIndex((t) => t.id === tabId)
          const leftIndex = Math.max(0, removedIndex - 1)
          newActiveId = newTabs[Math.min(leftIndex, newTabs.length - 1)]?.id ?? 'home'
        }

        set({ tabs: newTabs, activeTabId: newActiveId })
        return newActiveId
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
