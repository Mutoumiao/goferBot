import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Tab, TabType } from '@/types'
import { getTabRouteConfig, TAB_ROUTE_CONFIG } from '@/router/tab-routes'

function getDefaultTitle(type: TabType): string {
  return TAB_ROUTE_CONFIG.find((c) => c.tabType === type)?.defaultTitle ?? '未命名'
}

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<Tab[]>([
    { id: 'home', type: 'chat', title: '首页', sessionId: undefined, closable: false },
  ])
  const activeTabId = ref<string>('home')

  const activeTab = computed(
    () => tabs.value.find((t) => t.id === activeTabId.value) ?? null,
  )

  // 侧边栏导航入口：通过 routeName 创建/激活标签
  function addTabByRoute(routeName: string): Tab | null {
    const config = getTabRouteConfig(routeName)
    if (!config) {
      console.warn(`[tabsStore] No tab config for route "${routeName}", skipping`)
      return null
    }

    if (config.singleton) {
      const existing = tabs.value.find((t) => t.type === config.tabType)
      if (existing) {
        activeTabId.value = existing.id
        return existing
      }
    }

    const id = config.singleton ? `tab-${config.tabType}` : `tab-${Date.now()}`
    const newTab: Tab = {
      id,
      type: config.tabType,
      title: config.defaultTitle,
      closable: true,
    }
    tabs.value.push(newTab)
    activeTabId.value = id
    return newTab
  }

  // 直接添加标签（用于 ChatView 新建会话等场景，不做 singleton 检查）
  function addTab(type: TabType, sessionId?: string, title?: string): Tab {
    const id = type === 'chat' ? `tab-${Date.now()}` : `tab-${type}`
    const newTab: Tab = {
      id,
      type,
      title: title ?? getDefaultTitle(type),
      sessionId,
      closable: true,
    }
    tabs.value.push(newTab)
    activeTabId.value = id
    return newTab
  }

  function closeTab(tabId: string) {
    const idx = tabs.value.findIndex((t) => t.id === tabId)
    if (idx === -1) return
    const tab = tabs.value[idx]

    // home 标签永远不可关闭
    if (tab.id === 'home') return

    // 检查是否可以关闭（混合场景下的最后一个非 chat 标签）
    if (!canClose(tab)) return

    tabs.value.splice(idx, 1)

    // 激活左侧相邻标签
    if (activeTabId.value === tabId) {
      const newIdx = Math.max(0, idx - 1)
      const target = tabs.value[newIdx]
      if (target) {
        activeTabId.value = target.id
      } else {
        // 全部关闭 → 自动创建 home
        createHomeTab()
      }
    }
  }

  function canClose(tab: Tab): boolean {
    if (tab.id === 'home') return false

    // 排除 home 标签后的可关闭标签数 ≤ 1 时可关（之后自动创建 home）
    const closableTabs = tabs.value.filter((t) => t.id !== 'home')
    if (closableTabs.length <= 1) return true

    // 非 chat 标签在混合场景下检查
    if (tab.type !== 'chat') {
      const nonChatTabs = tabs.value.filter((t) => t.type !== 'chat' && t.id !== 'home')
      if (nonChatTabs.length === 1) {
        const chatExists = tabs.value.some((t) => t.type === 'chat')
        if (chatExists) return false // 最后一个非 chat，有 chat 存在时不可关
      }
    }

    return true
  }

  function createHomeTab() {
    tabs.value = [{
      id: 'home',
      type: 'chat',
      title: '首页',
      sessionId: undefined,
      closable: false,
    }]
    activeTabId.value = 'home'
  }

  function switchTab(tabId: string) {
    activeTabId.value = tabId
  }

  function renameTab(tabId: string, title: string) {
    const tab = tabs.value.find((t) => t.id === tabId)
    if (tab) tab.title = title
  }

  function updateHomeTabSession(sessionId: string, title: string) {
    const homeTab = tabs.value.find((t) => t.id === 'home')
    if (homeTab) {
      homeTab.sessionId = sessionId
      homeTab.title = title
    }
  }

  function updateActiveTabSession(sessionId: string, title: string) {
    const tab = tabs.value.find((t) => t.id === activeTabId.value)
    if (tab) {
      tab.sessionId = sessionId
      tab.title = title
    }
  }

  return {
    tabs, activeTabId, activeTab,
    addTab, addTabByRoute, closeTab, switchTab, renameTab,
    updateHomeTabSession, updateActiveTabSession,
  }
})
