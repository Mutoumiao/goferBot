<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import AppSidebar from '@/components/layout/AppSidebar.vue'

const route = useRoute()
const router = useRouter()

function handleNavigate(name: string) {
  router.push({ name })
}
</script>

<template>
  <div class="flex h-screen bg-surface-1 text-text-primary">
    <AppSidebar
      :active-type="(route.name as string) ?? 'chat'"
      @navigate="handleNavigate"
    />
    <main class="flex-1 overflow-hidden pb-12 md:pb-0">
      <RouterView />
    </main>
  </div>
</template>
