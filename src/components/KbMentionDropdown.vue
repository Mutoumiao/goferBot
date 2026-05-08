<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { KnowledgeBase } from '@/types'

const props = defineProps<{
  knowledgeBases: KnowledgeBase[]
  query: string
  visible: boolean
}>()

const emit = defineEmits<{
  select: [kb: KnowledgeBase]
  close: []
}>()

const selectedIndex = ref(0)

const filtered = computed(() => {
  const q = props.query.toLowerCase()
  if (!q) return props.knowledgeBases
  return props.knowledgeBases.filter((kb) => kb.name.toLowerCase().includes(q))
})

watch(() => filtered.value.length, () => {
  selectedIndex.value = 0
})

watch(() => props.visible, (v) => {
  if (v) selectedIndex.value = 0
})

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
    if (kb) emit('select', kb)
  } else if (e.key === 'Escape') {
    emit('close')
  }
}

defineExpose({ handleKeydown })
</script>

<template>
  <div
    v-if="visible && filtered.length > 0"
    data-testid="kb-mention-dropdown"
    class="absolute bottom-full left-0 mb-2 max-h-48 w-64 overflow-y-auto rounded-lg border border-border-default bg-surface-1 shadow-lg"
  >
    <div
      v-for="(kb, i) in filtered"
      :key="kb.id"
      data-testid="kb-mention-item"
      :class="[
        'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors',
        i === selectedIndex ? 'bg-accent-500/10 text-accent-600' : 'text-text-primary hover:bg-surface-3',
      ]"
      @mousedown.prevent="$emit('select', kb)"
    >
      <span :class="[kb.icon || 'i-mdi-database', 'text-base text-text-secondary']" />
      <span class="truncate">{{ kb.name }}</span>
    </div>
  </div>
</template>
