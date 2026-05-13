<script setup lang="ts">
import type { Tab } from '@/types'

defineProps<{
  tabs: Tab[]
  activeTabId: string
}>()

const emit = defineEmits<{
  switch: [tabId: string]
  close: [tabId: string]
  newChat: []
}>()
</script>

<template>
  <!-- 设计稿「Top tabs」：高 52、填充 #F7F8FA、内边距 [10,14]、标签间距 8 -->
  <div class="flex h-[52px] shrink-0 items-center gap-2 bg-surface-1 py-2.5 px-3.5">
    <div class="flex flex-1 gap-2 overflow-x-auto no-scrollbar">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="[
          'group relative flex h-8 shrink-0 items-center gap-2 rounded-[10px] px-3 text-[13px] transition-all duration-200',
          activeTabId === tab.id
            ? 'border border-border-default bg-white text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
            : 'bg-tab-ghost text-text-secondary hover:bg-surface-3 hover:text-text-primary',
        ]"
        @click="emit('switch', tab.id)"
      >
        <!-- Active dot -->
        <span
          v-if="activeTabId === tab.id"
          class="h-[7px] w-[7px] rounded-full bg-accent-500"
        />

        <span class="max-w-[140px] truncate">{{ tab.title }}</span>

        <!-- Close button -->
        <span
          v-if="tab.closable && tabs.length > 1"
          class="i-mdi-close ml-0.5 cursor-pointer rounded p-0.5 text-[14px] text-text-tertiary opacity-0 transition-all duration-150 group-hover:opacity-100 hover:bg-surface-2 hover:text-text-primary"
          @click.stop="emit('close', tab.id)"
        />
      </button>
    </div>

    <!-- New chat button -->
    <button
      data-testid="new-chat-btn"
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-text-tertiary transition-all duration-200 hover:bg-tab-ghost hover:text-text-secondary"
      title="新建会话"
      @click="emit('newChat')"
    >
      <span class="i-mdi-plus text-base" />
    </button>
  </div>
</template>
