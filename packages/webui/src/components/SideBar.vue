<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { SparklesIcon, MessageSquareTextIcon, DatabaseIcon, HistoryIcon, Trash2Icon, SettingsIcon } from 'lucide-vue-next'

const props = defineProps<{
  activeType?: string
}>()

const emit = defineEmits<{
  openChat: []
  openKnowledgeBase: []
  openHistory: []
  openSettings: []
  openRecycleBin: []
}>()

const navItems = [
  { type: 'chat', icon: MessageSquareTextIcon, action: () => emit('openChat') },
  { type: 'knowledgeBase', icon: DatabaseIcon, action: () => emit('openKnowledgeBase') },
]

const bottomItems = [
  { type: 'history', icon: HistoryIcon, action: () => emit('openHistory') },
  { type: 'recycleBin', icon: Trash2Icon, action: () => emit('openRecycleBin') },
  { type: 'settings', icon: SettingsIcon, action: () => emit('openSettings') },
]

function isActive(type: string) {
  return props.activeType === type
}
</script>

<template>
  <div class="flex w-16 shrink-0 flex-col items-center justify-between bg-surface-nav py-5 px-3">
    <div class="flex flex-col items-center gap-3">
      <div
        class="flex h-9 w-9 items-center justify-center rounded-2xl border border-border-default bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      >
        <SparklesIcon class="size-5 text-accent-500" />
      </div>

      <Button
        v-for="item in navItems"
        :key="item.type"
        variant="ghost"
        size="icon"
        :class="[
          'h-10 w-10 rounded-2xl transition-all duration-200',
          isActive(item.type)
            ? 'bg-nav-active text-text-primary hover:bg-nav-active'
            : 'text-text-tertiary hover:bg-surface-3/70 hover:text-text-secondary',
        ]"
        @click="item.action"
      >
        <Component :is="item.icon" class="size-5" />
      </Button>
    </div>

    <div class="flex flex-col items-center gap-2.5">
      <Button
        v-for="item in bottomItems"
        :key="item.type"
        variant="ghost"
        size="icon"
        :class="[
          'h-10 w-10 rounded-2xl transition-all duration-200',
          isActive(item.type)
            ? 'bg-nav-active text-text-primary hover:bg-nav-active'
            : 'text-text-tertiary hover:bg-surface-3/70 hover:text-text-secondary',
        ]"
        @click="item.action"
      >
        <Component :is="item.icon" class="size-5" />
      </Button>
    </div>
  </div>
</template>
