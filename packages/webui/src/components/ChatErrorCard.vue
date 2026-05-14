<script setup lang="ts">
import type { ChatErrorType } from '@/types'
import { Button } from '@/components/ui/button'
import { AlertCircleIcon } from 'lucide-vue-next'

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
  <div data-testid="chat-error-card" class="my-3 flex items-start gap-3 rounded-xl border border-danger-500/20 bg-danger-soft p-4">
    <AlertCircleIcon class="size-5 text-danger-500" />
    <div class="flex-1">
      <p class="text-sm font-medium text-danger-500">{{ typeLabels[props.errorType] || '错误' }}</p>
      <p class="mt-1 text-sm text-text-secondary">{{ props.message }}</p>
      <Button
        data-testid="chat-error-retry"
        variant="destructive"
        size="sm"
        class="mt-2"
        @click="emit('retry')"
      >
        重试
      </Button>
    </div>
  </div>
</template>
