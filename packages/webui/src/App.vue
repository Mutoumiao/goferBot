<script setup lang="ts">
import { onMounted } from 'vue'
import { useSettingsStore } from './stores/settings'
import { useAuthStore } from './stores/auth'
import ConfigProvider from './components/ConfigProvider.vue'
import { OverlayHost } from './overlays'

const settingsStore = useSettingsStore()
const authStore = useAuthStore()

onMounted(() => {
  if (authStore.isAuthenticated) {
    settingsStore.loadConfig()
  }
})
</script>

<template>
  <ConfigProvider>
    <RouterView />
    <OverlayHost />
  </ConfigProvider>
</template>
