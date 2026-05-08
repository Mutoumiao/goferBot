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
  <div class="flex h-10 shrink-0 items-center gap-0.5 border-b border-border-default bg-surface-1 px-2">
    <div class="flex flex-1 gap-0.5 overflow-x-auto no-scrollbar">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="[
          'group relative flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-all duration-200',
          activeTabId === tab.id
            ? 'bg-surface-3 text-text-primary'
            : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
        ]"
        @click="emit('switch', tab.id)"
      >
        <!-- Tab icon -->
        <span
          v-if="tab.type === 'chat'"
          class="i-mdi-chat-outline text-xs opacity-70"
        />
        <span
          v-else-if="tab.type === 'knowledgeBase'"
          class="i-mdi-folder text-xs opacity-70"
        />
        <span
          v-else-if="tab.type === 'history'"
          class="i-mdi-history text-xs opacity-70"
        />
        <span
          v-else-if="tab.type === 'settings'"
          class="i-mdi-cog text-xs opacity-70"
        />
        <span
          v-else-if="tab.type === 'recycleBin'"
          class="i-mdi-delete text-xs opacity-70"
        />

        <span class="max-w-[140px] truncate">{{ tab.title }}</span>

        <!-- Close button -->
        <span
          v-if="tab.closable && tabs.length > 1"
          :class="[
            'i-mdi-close ml-0.5 cursor-pointer rounded p-0.5 text-[10px] opacity-0 transition-all duration-150',
            activeTabId === tab.id
              ? 'text-text-tertiary group-hover:opacity-100 hover:bg-surface-4 hover:text-danger-400'
              : 'text-text-tertiary group-hover:opacity-100 hover:bg-surface-3 hover:text-danger-400',
          ]"
          @click.stop="emit('close', tab.id)"
        />
      </button>
    </div>

    <!-- New chat button -->
    <button
      class="ml-1 flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-text-tertiary transition-all duration-200 hover:bg-surface-2 hover:text-text-secondary"
      title="新建会话"
      @click="emit('newChat')"
    >
      <span class="i-mdi-plus text-sm" />
      <span class="hidden sm:inline">新会话</span>
    </button>
  </div>
</template>
