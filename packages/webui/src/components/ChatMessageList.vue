<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import type { Message } from '@/stores/session'
import { MessageSquareIcon } from 'lucide-vue-next'
import ChatMessage from './ChatMessage.vue'

const props = defineProps<{
  messages: Message[]
  isSending?: boolean
}>()

const containerRef = ref<HTMLDivElement>()
const shouldAutoScroll = ref(true)

let scrollTicking = false
function handleScroll() {
  if (scrollTicking) return
  scrollTicking = true
  requestAnimationFrame(() => {
    const el = containerRef.value
    if (el) {
      const threshold = 50
      shouldAutoScroll.value = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    }
    scrollTicking = false
  })
}

const lastMessage = computed(() => props.messages[props.messages.length - 1])

watch(
  () => [props.messages.length, lastMessage.value?.content],
  async () => {
    if (!shouldAutoScroll.value) return
    await nextTick()
    containerRef.value?.scrollTo({
      top: containerRef.value.scrollHeight,
      behavior: 'smooth',
    })
  },
  { flush: 'post' },
)
</script>

<template>
  <div
    ref="containerRef"
    data-testid="chat-message-list"
    class="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-6"
    @scroll="handleScroll"
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
        <ChatMessage
          v-for="(msg, index) in messages"
          :key="msg.id"
          :message="msg"
          :style="{ animationDelay: `${index * 30}ms` }"
        />
      </template>

      <!-- Loading indicator when AI is thinking -->
      <div
        v-if="isSending && messages.length > 0 && messages[messages.length - 1].role === 'user'"
        class="flex w-full justify-start"
      >
        <div class="flex max-w-[85%] gap-3">
          <div class="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
            <div class="size-4 animate-pulse rounded-full bg-accent-500/40" />
          </div>
          <div class="rounded-2xl border border-border-default bg-white px-4 py-3">
            <div class="flex gap-1">
              <div class="size-2 animate-bounce rounded-full bg-text-tertiary" style="animation-delay: 0ms" />
              <div class="size-2 animate-bounce rounded-full bg-text-tertiary" style="animation-delay: 150ms" />
              <div class="size-2 animate-bounce rounded-full bg-text-tertiary" style="animation-delay: 300ms" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
