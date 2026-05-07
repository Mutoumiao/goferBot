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
  <div class="flex h-[38px] shrink-0 items-center gap-1 border-b border-gray-700 bg-gray-800 px-2">
    <div class="flex flex-1 gap-1 overflow-x-auto no-scrollbar">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="[
          'flex shrink-0 items-center gap-1.5 rounded-t-md px-3 py-1.5 text-sm transition-colors',
          activeTabId === tab.id
            ? 'bg-gray-700 text-gray-200'
            : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200',
        ]"
        @click="emit('switch', tab.id)"
      >
        <span class="max-w-[120px] truncate">{{ tab.title }}</span>
        <span
          v-if="tab.closable"
          class="icon-[mdi--close] ml-0.5 cursor-pointer rounded p-0.5 text-xs hover:bg-gray-600 hover:text-red-400"
          @click.stop="emit('close', tab.id)"
        />
      </button>
    </div>
    <button
      class="icon-[mdi--plus] shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
      title="新建会话"
      @click="emit('newChat')"
    />
  </div>
</template>
