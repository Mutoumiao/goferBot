<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SideBar from './components/SideBar.vue'
import { useSettingsStore } from './stores/settings'

const route = useRoute()
const router = useRouter()
const settingsStore = useSettingsStore()

onMounted(async () => {
  settingsStore.loadConfig()
})

function navigateTo(name: string) {
  router.push({ name })
}
</script>

<template>
  <div class="flex h-screen bg-surface-1 text-text-primary">
    <SideBar
      :active-type="(route.name as string) ?? 'chat'"
      @open-chat="navigateTo('chat')"
      @open-knowledge-base="navigateTo('knowledgeBase')"
      @open-history="navigateTo('history')"
      @open-settings="navigateTo('settings')"
      @open-recycle-bin="navigateTo('recycleBin')"
    />
    <main class="flex-1 overflow-hidden">
      <RouterView />
    </main>
  </div>
</template>
