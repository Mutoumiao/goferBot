<script setup lang="ts">
import type { Message } from '@/stores/session'
import { BotIcon, UserIcon } from 'lucide-vue-next'
import MarkdownRender from './MarkdownRender.vue'

defineProps<{
  message: Message
}>()
</script>

<template>
  <div
    data-testid="chat-message"
    :class="[
      'flex w-full',
      message.role === 'user' ? 'justify-end' : 'justify-start',
    ]"
  >
    <div class="flex max-w-[85%] gap-3">
      <!-- AI Avatar -->
      <div
        v-if="message.role === 'assistant'"
        class="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft"
      >
        <BotIcon class="size-4 text-accent-500" />
      </div>

      <div
        :class="[
          'relative overflow-hidden rounded-2xl px-4 py-3 shadow-xs',
          message.role === 'user'
            ? 'bg-accent-500 text-white'
            : 'border border-border-default bg-white text-text-primary',
        ]"
      >
        <!-- AI message top accent line -->
        <div
          v-if="message.role === 'assistant'"
          class="absolute left-0 top-0 h-full w-[2px] bg-accent-500/40"
        />

        <div v-if="message.role === 'user'" class="whitespace-pre-wrap text-sm leading-relaxed">
          {{ message.content }}
        </div>
        <MarkdownRender v-else :content="message.content" />
      </div>

      <!-- User Avatar -->
      <div
        v-if="message.role === 'user'"
        class="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2"
      >
        <UserIcon class="size-4 text-text-secondary" />
      </div>
    </div>
  </div>
</template>
