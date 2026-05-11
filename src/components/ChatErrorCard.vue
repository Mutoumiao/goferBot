<script setup lang="ts">
import type { ChatErrorType } from '@/types'

const props = defineProps<{
  message: string
  errorType: ChatErrorType
}>()

const emit = defineEmits<{
  retry: []
}>()

const typeLabels: Record<ChatErrorType, string> = {
  api_error: 'API 错误',
  network_error: '网络错误',
  sidecar_error: '服务错误',
  unknown: '未知错误',
}
</script>

<template>
  <div data-testid="chat-error-card" class="my-3 flex items-start gap-3 rounded-xl border border-danger-500/30 bg-danger-500/10 p-4">
    <span class="i-mdi-alert-circle text-lg text-danger-400" />
    <div class="flex-1">
      <p class="text-sm font-medium text-danger-400">{{ typeLabels[props.errorType] || '错误' }}</p>
      <p class="mt-1 text-sm text-text-secondary">{{ props.message }}</p>
      <button
        data-testid="chat-error-retry"
        class="mt-2 rounded-md bg-danger-500 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-danger-400"
        @click="emit('retry')"
      >
        重试
      </button>
    </div>
  </div>
</template>
