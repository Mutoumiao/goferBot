<script setup lang="ts">
import type { Tab } from '@/types'
import { Button } from '@/components/ui/button'
import { PlusIcon, XIcon } from 'lucide-vue-next'
import { ref, nextTick } from 'vue'

defineProps<{
  tabs: Tab[]
  activeTabId: string
}>()

const emit = defineEmits<{
  switch: [tabId: string]
  close: [tabId: string]
  newChat: []
  rename: [tabId: string, title: string]
}>()

const editingTabId = ref<string | null>(null)
const editingTitle = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

function startRename(tab: Tab) {
  editingTabId.value = tab.id
  editingTitle.value = tab.title
  nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

function confirmRename(tabId: string) {
  const trimmed = editingTitle.value.trim()
  if (trimmed) {
    emit('rename', tabId, trimmed)
  }
  editingTabId.value = null
  editingTitle.value = ''
}

function cancelRename() {
  editingTabId.value = null
  editingTitle.value = ''
}

function handleKeydown(e: KeyboardEvent, tabId: string) {
  if (e.key === 'Enter') {
    e.preventDefault()
    confirmRename(tabId)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    cancelRename()
  }
}

function handleBlur(tabId: string) {
  if (editingTabId.value === tabId) {
    confirmRename(tabId)
  }
}
</script>

<template>
  <div data-testid="tab-bar" class="flex h-[38px] shrink-0 items-center gap-2 bg-surface-1 px-3.5">
    <div class="flex flex-1 gap-2 overflow-x-auto no-scrollbar">
      <Button
        v-for="tab in tabs"
        :key="tab.id"
        variant="ghost"
        :class="[
          'group relative flex shrink-0 items-center gap-2 rounded-[10px] px-3 py-1.5 text-[13px] transition-all duration-200',
          activeTabId === tab.id
            ? 'bg-white text-text-primary shadow-xs border border-border-default hover:bg-white'
            : 'bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary',
        ]"
        :data-testid="`chat-tab-${tab.id}`"
        @click="emit('switch', tab.id)"
      >
        <!-- Active dot -->
        <span
          v-if="activeTabId === tab.id"
          class="h-[7px] w-[7px] rounded-full bg-accent-500"
        />

        <!-- Editing state -->
        <input
          v-if="editingTabId === tab.id"
          ref="inputRef"
          v-model="editingTitle"
          :data-testid="`tab-edit-input-${tab.id}`"
          class="max-w-[120px] bg-transparent text-[13px] text-text-primary outline-none"
          @keydown="handleKeydown($event, tab.id)"
          @blur="handleBlur(tab.id)"
          @click.stop
        />

        <!-- Normal state -->
        <span
          v-else
          class="max-w-[140px] truncate"
          @dblclick.stop="startRename(tab)"
        >
          {{ tab.title }}
        </span>

        <!-- Close button -->
        <XIcon
          v-if="tab.closable && tabs.length > 1"
          data-testid="tab-close-btn"
          class="ml-0.5 size-3.5 cursor-pointer rounded p-0.5 text-text-tertiary opacity-0 transition-all duration-150 group-hover:opacity-100 hover:bg-surface-2 hover:text-text-primary"
          @click.stop="emit('close', tab.id)"
        />
      </Button>
    </div>

    <!-- New chat button -->
    <Button
      data-testid="new-chat-btn"
      variant="ghost"
      size="icon-sm"
      class="rounded-[10px]"
      title="新建会话"
      @click="emit('newChat')"
    >
      <PlusIcon class="size-4" />
    </Button>
  </div>
</template>
