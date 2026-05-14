<script setup lang="ts">
import type { KnowledgeBase } from '@/types'
import { Button } from '@/components/ui/button'
import { DatabaseIcon, XIcon } from 'lucide-vue-next'

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
    class="inline-flex items-center gap-1 rounded-lg bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-500"
  >
    <DatabaseIcon class="size-4" />
    {{ props.kb.name }}
    <Button
      variant="ghost"
      size="icon-xs"
      class="ml-0.5 h-auto w-auto rounded-sm hover:bg-accent-500/10"
      @click.stop="$emit('remove')"
    >
      <XIcon class="size-3.5" />
    </Button>
  </span>
</template>
