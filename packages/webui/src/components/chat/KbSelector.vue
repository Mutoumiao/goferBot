<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { KnowledgeBase } from '@/types'
import { DatabaseIcon } from 'lucide-vue-next'
import { Skeleton } from '@/components/ui/skeleton'

const props = defineProps<{
  knowledgeBases: KnowledgeBase[]
  selectedIds: string[]
  visible: boolean
  loading?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  select: [kb: KnowledgeBase]
  unselect: [kbId: string]
  close: []
  retry: []
}>()

const selectedIndex = ref(0)

const filtered = computed(() => {
  return props.knowledgeBases
})

watch(() => filtered.value.length, () => {
  selectedIndex.value = 0
})

watch(() => props.visible, (v) => {
  if (v) selectedIndex.value = 0
})

function toggleKb(kb: KnowledgeBase) {
  if (props.selectedIds.includes(kb.id)) {
    emit('unselect', kb.id)
  } else {
    emit('select', kb)
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.visible) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value + 1) % filtered.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value - 1 + filtered.value.length) % filtered.value.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const kb = filtered.value[selectedIndex.value]
    if (kb) toggleKb(kb)
  } else if (e.key === 'Escape') {
    emit('close')
  }
}

defineExpose({ handleKeydown })
</script>

<template>
  <div
    v-if="visible"
    data-testid="kb-selector-dropdown"
    class="absolute bottom-full left-0 mb-2 max-h-48 w-72 overflow-y-auto rounded-xl border border-border-default bg-white shadow-xl"
  >
    <div v-if="loading" class="space-y-2 p-3">
      <Skeleton v-for="i in 3" :key="i" class="h-8 w-full" />
    </div>
    <div v-else-if="error" class="space-y-2 p-4 text-center text-sm">
      <p class="text-text-secondary">{{ error }}</p>
      <button
        data-testid="kb-selector-retry"
        class="text-accent-500 hover:underline"
        @click="$emit('retry')"
      >
        重试
      </button>
    </div>
    <div v-else-if="knowledgeBases.length === 0" class="p-4 text-center text-sm text-text-secondary">
      请先创建知识库
    </div>
    <div
      v-for="(kb, i) in filtered"
      :key="kb.id"
      data-testid="kb-selector-item"
      :class="[
        'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors',
        i === selectedIndex ? 'bg-accent-soft text-accent-500' : 'text-text-primary hover:bg-surface-2',
      ]"
      @mousedown.prevent="toggleKb(kb)"
    >
      <input
        type="checkbox"
        :checked="selectedIds.includes(kb.id)"
        class="pointer-events-none size-4 rounded border-border-default text-accent-500 focus:ring-accent-500"
        readonly
      />
      <DatabaseIcon class="size-4 text-text-secondary" />
      <span class="truncate">{{ kb.name }}</span>
      <span class="ml-auto text-xs text-text-tertiary">{{ kb.documentCount || 0 }} 文档</span>
    </div>
  </div>
</template>
