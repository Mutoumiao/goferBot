<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { Message } from '@/types'
import { MessageSquareIcon } from 'lucide-vue-next'
import ChatMessage from './ChatMessage.vue'
import ChatErrorCard from './ChatErrorCard.vue'
import ChatLoading from './ChatLoading.vue'

const props = defineProps<{
  messages: Message[]
  isSending?: boolean
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
  <div
    ref="containerRef"
    data-testid="chat-message-list"
    class="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-6"
  >
    <div class="mx-auto w-full max-w-[760px] space-y-7">
      <!-- Empty state hint -->
      <div
        v-if="messages.length === 0"
        class="flex min-h-[min(360px,50vh)] flex-col items-center justify-center py-16 text-text-tertiary"
      >
        <MessageSquareIcon class="mb-3 size-10 opacity-30" />
        <p class="text-sm">开始你的第一次对话</p>
      </div>

      <template v-else>
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
      </template>

      <ChatLoading
        v-if="isSending && messages.length > 0 && messages[messages.length - 1].role === 'user'"
      />
    </div>
  </div>
</template>
