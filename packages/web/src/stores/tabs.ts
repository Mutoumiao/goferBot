import { create } from 'zustand'
import { ROUTES_REGISTER, type RouteMeta } from '@/router-register'

export interface Tab {
  id: string
  route: string
  title: string
  closable: boolean
  sessionId?: string
  isDirty: boolean
  isTemp?: boolean
  /** 最后访问时间戳，用于 LRU 缓存策略 */
  lastAccessed: number
}

export interface RouteInfo {
  pathname: string
  params: Record<string, string>
  tabMeta?: RouteMeta | null
}

/** removeTab 返回值：结构化表达关闭结果 */
export type RemoveTabResult =
  | { action: 'rejected' }
  | { action: 'navigate-new-temp' }
  | { action: 'switch'; targetId: string }

/** LRU 缓存配置 */
const MAX_TAB_CACHE = 10

interface TabsState {
  tabs: Tab[]
  activeTabId: string
  /** 临时会话 ID 集合，用于在路由 loader 中判断是否为临时会话 */
  tempSessionIds: Set<string>

  activeTab: () => Tab | null

  /** 创建临时会话标签并激活（导航前调用，确保标签先于路由存在） */
  addTempTab: (sessionId: string) => Tab
  /** 根据路由信息同步标签（路由驱动入口） */
  syncRoute: (routeInfo: RouteInfo) => Tab | null
  /** 移除标签，返回结构化结果 */
  removeTab: (tabId: string) => RemoveTabResult
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
  /** 判断 sessionId 是否为临时会话 */
  isTempSession: (sessionId: string) => boolean
  /** 将临时会话转换为真实会话 */
  promoteTempSession: (oldSessionId: string, newSessionId: string, title: string) => void
}

/** 获取当前时间戳 */
function now() {
  return Date.now()
}

/** 执行 LRU 清理：关闭最久未访问的非活跃标签，保留活跃标签 */
function performLRUCleanup(
  tabs: Tab[],
  activeTabId: string,
  maxCount: number,
): { cleanedTabs: Tab[]; removedIds: string[] } {
  if (tabs.length <= maxCount) {
    return { cleanedTabs: tabs, removedIds: [] }
  }

  // 保留活跃标签，按 lastAccessed 排序，关闭最久的
  const sorted = [...tabs]
    .filter((t) => t.id !== activeTabId)
    .sort((a, b) => a.lastAccessed - b.lastAccessed)

  const toRemoveCount = tabs.length - maxCount
  const toRemove = sorted.slice(0, toRemoveCount)
  const removedIds = toRemove.map((t) => t.id)
  const cleanedTabs = tabs.filter((t) => !removedIds.includes(t.id))

  return { cleanedTabs, removedIds }
}

export const useTabsStore = create<TabsState>()(
  (set, get) => ({
    tabs: [],
    activeTabId: '',
    tempSessionIds: new Set<string>(),

    activeTab: (): Tab | null => {
      const { tabs, activeTabId } = get()
      return tabs.find((t) => t.id === activeTabId) ?? null
    },

    addTempTab: (sessionId): Tab => {
      const nowTs = now()
      const tab: Tab = {
        id: sessionId,
        route: `/chat/${sessionId}`,
        title: ROUTES_REGISTER.chat.title,
        closable: true,
        sessionId,
        isDirty: false,
        isTemp: true,
        lastAccessed: nowTs,
      }
      set((state) => {
        const newTempIds = new Set([...state.tempSessionIds, sessionId])
        // 同步到 sessionStorage，实现刷新后持久化
        try {
          sessionStorage.setItem('tempSessionIds', JSON.stringify([...newTempIds]))
        } catch {
          // sessionStorage 不可用时静默处理
        }
        const newTabs = [...state.tabs, tab]
        const { cleanedTabs, removedIds } = performLRUCleanup(newTabs, tab.id, MAX_TAB_CACHE)
        // 清理被移除的临时会话 ID
        const finalTempIds = new Set(newTempIds)
        removedIds.forEach((id) => finalTempIds.delete(id))
        if (removedIds.length > 0) {
          try {
            sessionStorage.setItem('tempSessionIds', JSON.stringify([...finalTempIds]))
          } catch {
            // sessionStorage 不可用时静默处理
          }
        }
        return {
          tabs: cleanedTabs,
          activeTabId: tab.id,
          tempSessionIds: finalTempIds,
        }
      })
      return tab
    },

    syncRoute: (routeInfo): Tab | null => {
      const { tabs, activeTabId } = get()
      const { pathname, params, tabMeta } = routeInfo
      const nowTs = now()

      if (!tabMeta) return null

      const sessionId = params.sessionId

      // 单例页面：若已存在同 route 的标签则激活，不新建
      if (tabMeta.singleton) {
        const existing = tabs.find((t) => t.route === pathname)
        if (existing) {
          if (existing.id !== activeTabId) {
            set({
              activeTabId: existing.id,
              tabs: tabs.map((t) =>
                t.id === existing.id ? { ...t, lastAccessed: nowTs } : t,
              ),
            })
          }
          return null
        }
      }

      // 临时标签 → 真实会话转换：
      // 只有当前活跃标签是唯一的标签（首页场景）时才执行转换，
      // 避免用户主动新建的临时标签被误删（BUG1 修复）
      const activeTab = tabs.find((t) => t.id === activeTabId)
      const isOnlyTab = tabs.length === 1
      if (isOnlyTab && activeTab?.isTemp && sessionId && activeTab.sessionId !== sessionId) {
        // 先查找目标标签
        const targetTab = tabs.find((t) => t.sessionId === sessionId)

        // 如果目标也是临时标签，直接激活，不做转换
        if (targetTab?.isTemp) {
          set({
            activeTabId: targetTab.id,
            tabs: tabs.map((t) =>
              t.id === targetTab.id ? { ...t, lastAccessed: nowTs } : t,
            ),
          })
          return null
        }

        // 如果目标真实会话已有其他标签，激活已有标签，不删除当前临时标签
        const existingTarget = tabs.find((t) => t.sessionId === sessionId && t.id !== activeTabId)
        if (existingTarget) {
          set({
            activeTabId: existingTarget.id,
            tabs: tabs.map((t) =>
              t.id === existingTarget.id ? { ...t, lastAccessed: nowTs } : t,
            ),
          })
          return null
        }
        // 更新临时标签为真实会话
        set((state) => {
          const newTempIds = new Set(state.tempSessionIds)
          if (activeTab.sessionId) {
            newTempIds.delete(activeTab.sessionId)
          }
          // 同步更新 sessionStorage
          try {
            sessionStorage.setItem('tempSessionIds', JSON.stringify([...newTempIds]))
          } catch {
            // sessionStorage 不可用时静默处理
          }
          return {
            tabs: state.tabs.map((t) =>
              t.id === activeTabId
                ? { ...t, route: pathname, isTemp: false, sessionId, lastAccessed: nowTs }
                : t,
            ),
            tempSessionIds: newTempIds,
          }
        })
        return null
      }

      // 多实例页面：根据 sessionId 查找已有标签
      if (sessionId) {
        const existing = tabs.find((t) => t.sessionId === sessionId)
        if (existing) {
          if (existing.route !== pathname) {
            set({
              tabs: tabs.map((t) =>
                t.id === existing.id ? { ...t, route: pathname, lastAccessed: nowTs } : t,
              ),
              activeTabId: existing.id,
            })
          } else if (existing.id !== activeTabId) {
            set({
              activeTabId: existing.id,
              tabs: tabs.map((t) =>
                t.id === existing.id ? { ...t, lastAccessed: nowTs } : t,
              ),
            })
          }
          return null
        }
      }

      // 创建新标签（非临时——临时标签由 addTempTab 创建）
      const tab: Tab = {
        id: sessionId ?? crypto.randomUUID(),
        route: pathname,
        title: tabMeta.title,
        closable: tabMeta.closable,
        sessionId,
        isDirty: false,
        isTemp: false,
        lastAccessed: nowTs,
      }
      const newTabs = [...tabs, tab]
      const { cleanedTabs, removedIds } = performLRUCleanup(newTabs, tab.id, MAX_TAB_CACHE)
      if (removedIds.length > 0) {
        const removedTempIds = removedIds.filter((id) => get().tempSessionIds.has(id))
        if (removedTempIds.length > 0) {
          set((state) => {
            const newTempIds = new Set(state.tempSessionIds)
            removedTempIds.forEach((id) => newTempIds.delete(id))
            try {
              sessionStorage.setItem('tempSessionIds', JSON.stringify([...newTempIds]))
            } catch {
              // sessionStorage 不可用时静默处理
            }
            return { tempSessionIds: newTempIds }
          })
        }
      }
      set({ tabs: cleanedTabs, activeTabId: tab.id })
      return tab
    },

    removeTab: (tabId): RemoveTabResult => {
      const { tabs, activeTabId } = get()
      const target = tabs.find((t) => t.id === tabId)
      if (!target || !target.closable) {
        return { action: 'rejected' }
      }

      const newTabs = tabs.filter((t) => t.id !== tabId)

      // 只剩一个标签且是临时首页，不允许关闭
      if (tabs.length === 1 && target.isTemp) {
        return { action: 'rejected' }
      }

      // 关闭最后一个标签（真实对话），返回导航到新临时首页的指令
      if (newTabs.length === 0) {
        set({ tabs: [], activeTabId: '' })
        return { action: 'navigate-new-temp' }
      }

      let newActiveId: string | null = null
      if (activeTabId === tabId) {
        const removedIndex = tabs.findIndex((t) => t.id === tabId)
        const leftIndex = Math.max(0, removedIndex - 1)
        newActiveId = newTabs[Math.min(leftIndex, newTabs.length - 1)]?.id ?? null
      }

      set({ tabs: newTabs, activeTabId: newActiveId ?? activeTabId })
      return { action: 'switch', targetId: newActiveId ?? activeTabId }
    },

    activateTab: (tabId) => {
      const exists = get().tabs.some((t) => t.id === tabId)
      if (exists) {
        set({
          activeTabId: tabId,
          tabs: get().tabs.map((t) =>
            t.id === tabId ? { ...t, lastAccessed: now() } : t,
          ),
        })
      }
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

    isTempSession: (sessionId) => {
      // 优先检查 sessionStorage，实现刷新后持久化识别
      try {
        const stored = sessionStorage.getItem('tempSessionIds')
        if (stored) {
          const ids = JSON.parse(stored) as string[]
          if (ids.includes(sessionId)) return true
        }
      } catch {
        // sessionStorage 不可用时降级到内存状态
      }
      return get().tempSessionIds.has(sessionId)
    },

    promoteTempSession: (oldSessionId, newSessionId, title) => {
      set((state) => {
        const newTempIds = new Set(state.tempSessionIds)
        newTempIds.delete(oldSessionId)
        // 同步更新 sessionStorage
        try {
          sessionStorage.setItem('tempSessionIds', JSON.stringify([...newTempIds]))
        } catch {
          // sessionStorage 不可用时静默处理
        }
        return {
          tabs: state.tabs.map((t) =>
            t.sessionId === oldSessionId
              ? { ...t, sessionId: newSessionId, route: `/chat/${newSessionId}`, title, isTemp: false }
              : t,
          ),
          tempSessionIds: newTempIds,
        }
      })
    },
  }),
)
