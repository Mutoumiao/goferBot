<script setup lang="ts">
import type { KnowledgeBase } from '@/types'

const props = defineProps<{
  kb: KnowledgeBase
}>()

const emit = defineEmits<{
  remove: []
}>()
</script>

<template>
  <span
    data-testid="kb-mention-pill"
    class="inline-flex items-center gap-1 rounded-md bg-accent-500/15 px-2 py-0.5 text-xs font-medium text-accent-600"
  >
    <span :class="[props.kb.icon || 'i-mdi-database', 'text-sm']" />
    {{ props.kb.name }}
    <button
      class="ml-0.5 rounded-sm hover:bg-accent-500/20"
      @click.stop="$emit('remove')"
    >
      <span class="i-mdi-close text-sm" />
    </button>
  </span>
</template>
