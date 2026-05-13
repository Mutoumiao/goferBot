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
  <div class="flex w-16 shrink-0 flex-col items-center justify-between bg-[#F2F4F7] py-5 px-3">
    <!-- Primary Navigation -->
    <div class="flex flex-col items-center gap-3">
      <!-- Logo -->
      <div
        class="flex h-9 w-9 items-center justify-center rounded-2xl border border-[#E7EAF0] bg-white shadow-[0_1px_3px_#0000000A]"
      >
        <span class="i-mdi-sparkles text-lg text-[#5B7CFA]" />
      </div>

      <!-- Main nav items -->
      <button
        v-for="item in navItems"
        :key="item.type"
        :class="[
          'flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-200',
          isActive(item.type)
            ? 'bg-[#E8EBF2] text-[#1F2328]'
            : 'text-[#9AA3AF] hover:bg-[#E8EBF2]/60 hover:text-[#5E6673]',
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
            ? 'bg-[#E8EBF2] text-[#1F2328]'
            : 'text-[#9AA3AF] hover:bg-[#E8EBF2]/60 hover:text-[#5E6673]',
        ]"
        @click="item.action"
      >
        <span :class="[item.icon, 'text-lg']" />
      </button>
    </div>
  </div>
</template>
