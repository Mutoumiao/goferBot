<script setup lang="ts">
import type { TabType } from '@/types'

const props = defineProps<{
  activeType?: TabType
}>()

const emit = defineEmits<{
  openChat: []
  openKnowledgeBase: []
  openHistory: []
  openSettings: []
  openRecycleBin: []
}>()

const navItems = [
  { type: 'chat' as TabType, icon: 'i-mdi-message-text', label: '问答', action: () => emit('openChat') },
  { type: 'knowledgeBase' as TabType, icon: 'i-mdi-folder', label: '知识库', action: () => emit('openKnowledgeBase') },
]

const bottomItems = [
  { type: 'recycleBin' as TabType, icon: 'i-mdi-delete', label: '回收站', action: () => emit('openRecycleBin') },
  { type: 'history' as TabType, icon: 'i-mdi-history', label: '历史', action: () => emit('openHistory') },
  { type: 'settings' as TabType, icon: 'i-mdi-cog', label: '设置', action: () => emit('openSettings') },
]

function isActive(type: TabType) {
  return props.activeType === type
}
</script>

<template>
  <div class="flex w-[72px] shrink-0 flex-col items-center border-r border-border-default bg-surface-1 py-3">
    <!-- App Logo / Brand -->
    <div class="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/10">
      <span class="i-mdi-brain text-xl text-accent-400" />
    </div>

    <!-- Main Navigation -->
    <nav class="flex flex-1 flex-col gap-1">
      <button
        v-for="item in navItems"
        :key="item.type"
        :class="[
          'group relative flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 transition-all duration-200',
          isActive(item.type)
            ? 'text-accent-400'
            : 'text-text-tertiary hover:text-text-secondary',
        ]"
        @click="item.action"
      >
        <!-- Active indicator -->
        <div
          v-if="isActive(item.type)"
          class="absolute -left-[1px] top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-accent-500 transition-all"
        />
        <span
          :class="[
            item.icon,
            'text-[22px] transition-transform duration-200',
            isActive(item.type) ? 'scale-110' : 'group-hover:scale-105',
          ]"
        />
        <span class="text-[10px] font-medium leading-none">{{ item.label }}</span>
      </button>
    </nav>

    <!-- Bottom Navigation -->
    <nav class="flex flex-col gap-1">
      <button
        v-for="item in bottomItems"
        :key="item.type"
        :class="[
          'group relative flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 transition-all duration-200',
          isActive(item.type)
            ? 'text-accent-400'
            : 'text-text-tertiary hover:text-text-secondary',
        ]"
        @click="item.action"
      >
        <div
          v-if="isActive(item.type)"
          class="absolute -left-[1px] top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-accent-500 transition-all"
        />
        <span
          :class="[
            item.icon,
            'text-[22px] transition-transform duration-200',
            isActive(item.type) ? 'scale-110' : 'group-hover:scale-105',
          ]"
        />
        <span class="text-[10px] font-medium leading-none">{{ item.label }}</span>
      </button>
    </nav>
  </div>
</template>
