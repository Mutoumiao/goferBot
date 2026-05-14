<script setup lang="ts">
import { sidecarStatus, sidecarError, retrySidecarStatus } from '@/composables/useSidecarStatus'

async function handleRetry() {
  await retrySidecarStatus()
}
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-300"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-500"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="sidecarStatus !== 'ready'"
      class="fixed inset-0 z-50 flex items-center justify-center bg-surface-0"
    >
      <div class="text-center">
        <!-- Loading State -->
        <template v-if="sidecarStatus === 'loading'">
          <div
            class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-500/10 shadow-lg shadow-accent-glow"
          >
            <span class="i-mdi-brain text-3xl text-accent-400" />
          </div>
          <div
            class="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-[3px] border-surface-3 border-t-accent-400"
          />
          <p class="text-base font-medium text-text-primary">正在启动服务...</p>
          <p class="mt-1 text-sm text-text-tertiary">首次启动可能需要几秒钟</p>
        </template>

        <!-- Error State -->
        <template v-else-if="sidecarStatus === 'error'">
          <div
            class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-500/10"
          >
            <span class="i-mdi-alert-circle text-3xl text-danger-400" />
          </div>
          <p class="mb-1 text-base font-medium text-text-primary">服务启动失败</p>
          <p class="mb-6 max-w-sm text-sm text-text-secondary">{{ sidecarError || '无法连接到本地服务，请检查环境配置后重试' }}</p>
          <button
            class="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-accent-glow transition-all duration-200 hover:bg-accent-400 active:scale-95"
            @click="handleRetry"
          >
            <span class="i-mdi-refresh text-sm" />
            重试
          </button>
        </template>
      </div>
    </div>
  </Transition>
</template>
