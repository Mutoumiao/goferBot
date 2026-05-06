<script setup lang="ts">
import { sidecarStatus, sidecarError, retrySidecar } from '@/composables/useSidecar'

async function handleRetry() {
  await retrySidecar()
}
</script>

<template>
  <div
    v-if="sidecarStatus !== 'ready'"
    class="fixed inset-0 z-50 flex items-center justify-center bg-gray-800"
  >
    <div class="text-center">
      <template v-if="sidecarStatus === 'loading'">
        <div
          class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-600 border-t-blue-400"
        ></div>
        <p class="text-gray-200">正在启动服务...</p>
      </template>
      <template v-else-if="sidecarStatus === 'error'">
        <div class="mb-4 text-red-400">
          <span class="icon-[mdi--alert-circle] text-4xl"></span>
        </div>
        <p class="mb-4 text-gray-200">{{ sidecarError || '服务启动失败' }}</p>
        <button
          class="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          @click="handleRetry"
        >
          重试
        </button>
      </template>
    </div>
  </div>
</template>
