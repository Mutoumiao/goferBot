<script setup lang="ts">
import type { Message } from '@/types'
import MarkdownRender from './MarkdownRender.vue'

defineProps<{
  message: Message
}>()
</script>

<template>
  <div
    :class="[
      'flex w-full',
      message.role === 'user' ? 'justify-end' : 'justify-start',
    ]"
  >
    <div
      :class="[
        'max-w-[85%] rounded-lg px-4 py-2.5 shadow-sm',
        message.role === 'user'
          ? 'bg-blue-100 text-gray-900'
          : 'bg-white text-gray-900',
      ]"
    >
      <div v-if="message.role === 'user'" class="whitespace-pre-wrap text-sm leading-relaxed">
        {{ message.content }}
      </div>
      <MarkdownRender v-else :content="message.content" />
    </div>
  </div>
</template>
