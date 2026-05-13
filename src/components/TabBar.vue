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
  <div class="flex h-[52px] shrink-0 items-center gap-2 bg-[#F7F8FA] px-3.5">
    <div class="flex flex-1 gap-2 overflow-x-auto no-scrollbar">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="[
          'group relative flex shrink-0 items-center gap-2 rounded-[10px] px-3 py-2 text-[13px] transition-all duration-200',
          activeTabId === tab.id
            ? 'bg-white text-[#1F2328] shadow-[0_1px_2px_#00000008] border border-[#E7EAF0]'
            : 'bg-[#F0F2F5] text-[#5E6673] hover:bg-[#E8EBF2] hover:text-[#1F2328]',
        ]"
        @click="emit('switch', tab.id)"
      >
        <!-- Active dot -->
        <span
          v-if="activeTabId === tab.id"
          class="h-[7px] w-[7px] rounded-full bg-[#5B7CFA]"
        />

        <span class="max-w-[140px] truncate">{{ tab.title }}</span>

        <!-- Close button -->
        <span
          v-if="tab.closable && tabs.length > 1"
          class="i-mdi-close ml-0.5 cursor-pointer rounded p-0.5 text-[14px] text-[#9AA3AF] opacity-0 transition-all duration-150 group-hover:opacity-100 hover:bg-[#F0F2F5] hover:text-[#1F2328]"
          @click.stop="emit('close', tab.id)"
        />
      </button>
    </div>

    <!-- New chat button -->
    <button
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[#9AA3AF] transition-all duration-200 hover:bg-[#F0F2F5] hover:text-[#5E6673]"
      title="新建会话"
      @click="emit('newChat')"
    >
      <span class="i-mdi-plus text-base" />
    </button>
  </div>
</template>
