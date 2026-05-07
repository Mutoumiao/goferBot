<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { Message } from '@/types'
import ChatMessage from './ChatMessage.vue'

const props = defineProps<{
  messages: Message[]
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
  <div ref="containerRef" class="flex-1 overflow-y-auto space-y-4 p-4">
    <ChatMessage
      v-for="msg in messages"
      :key="msg.id"
      :message="msg"
    />
  </div>
</template>
