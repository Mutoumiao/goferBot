<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { Message } from '@/types'
import ChatMessage from './ChatMessage.vue'
import ChatErrorCard from './ChatErrorCard.vue'

const props = defineProps<{
  messages: Message[]
}>()

const emit = defineEmits<{
  retry: []
}>()

const containerRef = ref<HTMLDivElement>()

watch(
  () => props.messages.length,
  async () => {
    await nextTick()
    containerRef.value?.scrollTo({
      top: containerRef.value.scrollHeight,
      behavior: 'smooth',
    })
  }
)
</script>

<template>
  <div ref="containerRef" data-testid="chat-message-list" class="flex-1 overflow-y-auto space-y-5 p-5">
    <!-- Empty state hint -->
    <div
      v-if="messages.length === 0"
      class="flex h-full flex-col items-center justify-center text-text-tertiary"
    >
      <span class="i-mdi-chat-outline mb-3 text-4xl opacity-30" />
      <p class="text-sm">开始你的第一次对话</p>
    </div>

    <template v-for="(msg, index) in messages" :key="msg.id">
      <ChatErrorCard
        v-if="msg.role === 'error'"
        :message="msg.content"
        :error-type="msg.errorType || 'unknown'"
        @retry="emit('retry')"
      />
      <ChatMessage
        v-else
        :message="msg"
        :style="{ animationDelay: `${index * 30}ms` }"
      />
    </template>
  </div>
</template>
