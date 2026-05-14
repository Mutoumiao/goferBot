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
  { type: 'chat' as TabType, icon: 'i-mdi-message-text-outline', action: () => emit('openChat') },
  { type: 'knowledgeBase' as TabType, icon: 'i-mdi-database-outline', action: () => emit('openKnowledgeBase') },
]

const bottomItems = [
  { type: 'history' as TabType, icon: 'i-mdi-history', action: () => emit('openHistory') },
  { type: 'recycleBin' as TabType, icon: 'i-mdi-trash-can-outline', action: () => emit('openRecycleBin') },
  { type: 'settings' as TabType, icon: 'i-mdi-cog-outline', action: () => emit('openSettings') },
]

function isActive(type: TabType) {
  return props.activeType === type
}
</script>

<template>
  <!-- 设计稿「Left nav」：宽 64、填充 #F2F4F7、内边距 [20,12]、主区 gap 12、次区 gap 10 -->
  <div class="flex w-16 shrink-0 flex-col items-center justify-between bg-surface-nav py-5 px-3">
    <!-- Primary Navigation -->
    <div class="flex flex-col items-center gap-3">
      <!-- Logo：36×36、圆角 16、白底、细描边、轻阴影 -->
      <div
        class="flex h-9 w-9 items-center justify-center rounded-2xl border border-border-default bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      >
        <span class="i-mdi-sparkles text-lg text-accent-500" />
      </div>

      <!-- Main nav items：40×40、圆角 16；激活 #E8EBF2 -->
      <button
        v-for="item in navItems"
        :key="item.type"
        :class="[
          'flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-200',
          isActive(item.type)
            ? 'bg-nav-active text-text-primary'
            : 'text-text-tertiary hover:bg-surface-3/70 hover:text-text-secondary',
        ]"
        @click="item.action"
      >
        <span :class="[item.icon, 'text-lg']" />
      </button>
    </div>

    <!-- Secondary Navigation -->
    <div class="flex flex-col items-center gap-2.5">
      <button
        v-for="item in bottomItems"
        :key="item.type"
        :class="[
          'flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-200',
          isActive(item.type)
            ? 'bg-nav-active text-text-primary'
            : 'text-text-tertiary hover:bg-surface-3/70 hover:text-text-secondary',
        ]"
        @click="item.action"
      >
        <span :class="[item.icon, 'text-lg']" />
      </button>
    </div>
  </div>
</template>
