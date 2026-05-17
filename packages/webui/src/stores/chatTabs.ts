import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ChatTab {
  id: string
  title: string
  sessionId: string | null
  closable: boolean
}

export const useChatTabsStore = defineStore('chatTabs', () => {
  const tabs = ref<ChatTab[]>([
    { id: 'home', title: '首页', sessionId: null, closable: false },
  ])
  const activeTabId = ref<string>('home')

  const activeTab = computed(
    () => tabs.value.find((t) => t.id === activeTabId.value) ?? null
  )

  function addTab(sessionId: string, title: string) {
    const id = `tab-${Date.now()}`
    tabs.value.push({ id, title, sessionId, closable: true })
    activeTabId.value = id
  }

  function closeTab(tabId: string) {
    const idx = tabs.value.findIndex((t) => t.id === tabId)
    if (idx === -1) return
    const tab = tabs.value[idx]
    if (!tab.closable) return
    tabs.value.splice(idx, 1)
    if (activeTabId.value === tabId) {
      const newIdx = Math.max(0, idx - 1)
      activeTabId.value = tabs.value[newIdx]?.id ?? 'home'
    }
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

  return {
    tabs,
    activeTabId,
    activeTab,
    addTab,
    closeTab,
    switchTab,
    renameTab,
    updateHomeTabSession,
  }
})
