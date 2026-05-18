<script setup lang="ts">
import { onMounted } from 'vue'
import { useSettingsStore } from './stores/settings'
import ConfigProvider from './components/ConfigProvider.vue'

const settingsStore = useSettingsStore()

onMounted(() => {
  settingsStore.loadConfig()
})
</script>

<template>
  <ConfigProvider>
    <RouterView />
  </ConfigProvider>
</template>
