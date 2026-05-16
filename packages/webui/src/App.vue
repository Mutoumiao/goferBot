<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppSidebar from './components/layout/AppSidebar.vue'
import { useSettingsStore } from './stores/settings'

const route = useRoute()
const router = useRouter()
const settingsStore = useSettingsStore()

const hideSidebar = computed(() => {
  return route.meta.hideSidebar === true
})

onMounted(async () => {
  settingsStore.loadConfig()
})

function handleNavigate(name: string) {
  router.push({ name })
}
</script>

<template>
  <div class="flex h-screen bg-surface-1 text-text-primary">
    <AppSidebar
      v-if="!hideSidebar"
      :active-type="(route.name as string) ?? 'chat'"
      @navigate="handleNavigate"
    />
    <main
      :class="[
        'flex-1 overflow-hidden',
        !hideSidebar ? 'pb-12 md:pb-0' : '',
      ]"
    >
      <RouterView />
    </main>
  </div>
</template>
