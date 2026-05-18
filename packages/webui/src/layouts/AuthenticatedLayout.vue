<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTabsStore } from '@/stores/tabs'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import TabBar from '@/components/layout/TabBar.vue'

const route = useRoute()
const router = useRouter()
const tabsStore = useTabsStore()

const routeMap: Record<string, string> = {
  chat: 'chat',
  knowledgeBase: 'knowledgeBase',
  history: 'history',
  settings: 'settings',
  recycleBin: 'recycleBin',
}

// 侧边栏导航 → 标签操作（URL 由 watch 统一同步）
function handleNavigate(routeName: string) {
  tabsStore.addTabByRoute(routeName)
}

// 标签切换 → 同步路由（唯一 URL 同步入口）
watch(() => tabsStore.activeTab, (tab) => {
  if (!tab) return
  const targetRoute = routeMap[tab.type] ?? 'chat'
  if (route.name !== targetRoute) {
    router.push({ name: targetRoute })
  }
})

function onTabSwitch(tabId: string) {
  tabsStore.switchTab(tabId)
}

function onTabClose(tabId: string) {
  tabsStore.closeTab(tabId)
}

function onNewChat() {
  // 创建空 chat 标签（无 session），session 在用户发送第一条消息时创建
  tabsStore.addTab('chat')
}

function onTabRename(tabId: string, title: string) {
  tabsStore.renameTab(tabId, title)
}
</script>

<template>
  <div class="flex h-screen bg-surface-1 text-text-primary">
    <AppSidebar
      :active-type="tabsStore.activeTab?.type ?? 'chat'"
      @navigate="handleNavigate"
    />
    <div class="flex flex-1 flex-col overflow-hidden">
      <!-- Header: 全局标签栏 -->
      <header class="shrink-0 border-b border-border-default bg-white" style="height: 38px">
        <TabBar
          :tabs="tabsStore.tabs"
          :active-tab-id="tabsStore.activeTabId"
          @switch="onTabSwitch"
          @close="onTabClose"
          @new-chat="onNewChat"
          @rename="onTabRename"
        />
      </header>
      <!-- 内容区 -->
      <main class="flex-1 overflow-hidden pb-12 md:pb-0">
        <RouterView />
      </main>
    </div>
  </div>
</template>
