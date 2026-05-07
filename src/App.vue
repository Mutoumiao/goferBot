<script setup lang="ts">
import { onMounted } from 'vue'
import SplashScreen from './components/SplashScreen.vue'
import SideBar from './components/SideBar.vue'
import TabBar from './components/TabBar.vue'
import ChatPage from './components/ChatPage.vue'
import { initSidecar, sidecarStatus } from './composables/useSidecar'
import { useSessionStore } from './stores/session'

const sessionStore = useSessionStore()

onMounted(() => {
  initSidecar()
})

function ensureHomeTab() {
  const homeTab = sessionStore.tabs.find((t) => t.type === 'chat' && !t.sessionId)
  if (homeTab) {
    sessionStore.switchTab(homeTab.id)
  } else {
    const newHomeId = `home-${Date.now()}`
    sessionStore.addTab({ id: newHomeId, type: 'chat', title: '首页', closable: false })
  }
}

function openKnowledgeBase() {
  const existing = sessionStore.tabs.find((t) => t.type === 'knowledgeBase')
  if (existing) {
    sessionStore.switchTab(existing.id)
  } else {
    sessionStore.addTab({ id: 'kb', type: 'knowledgeBase', title: '知识库', closable: true })
  }
}

function openHistory() {
  const existing = sessionStore.tabs.find((t) => t.type === 'history')
  if (existing) {
    sessionStore.switchTab(existing.id)
  } else {
    sessionStore.addTab({ id: 'history', type: 'history', title: '历史', closable: true })
  }
}

function openSettings() {
  const existing = sessionStore.tabs.find((t) => t.type === 'settings')
  if (existing) {
    sessionStore.switchTab(existing.id)
  } else {
    sessionStore.addTab({ id: 'settings', type: 'settings', title: '设置', closable: true })
  }
}
</script>

<template>
  <SplashScreen />
  <div
    v-if="sidecarStatus === 'ready'"
    class="flex h-screen bg-gray-800 text-gray-200"
  >
    <SideBar
      @open-chat="ensureHomeTab"
      @open-knowledge-base="openKnowledgeBase"
      @open-history="openHistory"
      @open-settings="openSettings"
    />
    <div class="flex flex-1 flex-col overflow-hidden">
      <TabBar
        :tabs="sessionStore.tabs"
        :active-tab-id="sessionStore.activeTabId"
        @switch="sessionStore.switchTab"
        @close="sessionStore.closeTab"
        @new-chat="ensureHomeTab"
      />
      <main class="flex-1 overflow-hidden">
        <ChatPage v-if="sessionStore.activeTab?.type === 'chat'" />
        <div
          v-else-if="sessionStore.activeTab?.type === 'knowledgeBase'"
          class="flex h-full items-center justify-center text-gray-400"
        >
          知识库管理（由 #03 实现）
        </div>
        <div
          v-else-if="sessionStore.activeTab?.type === 'history'"
          class="flex h-full items-center justify-center text-gray-400"
        >
          对话历史（由 #06 实现）
        </div>
        <div
          v-else-if="sessionStore.activeTab?.type === 'settings'"
          class="flex h-full items-center justify-center text-gray-400"
        >
          设置（由 #05 实现）
        </div>
      </main>
    </div>
  </div>
</template>
