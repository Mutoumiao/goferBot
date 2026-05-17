<script setup lang="ts">
import { ChevronRightIcon, HomeIcon } from 'lucide-vue-next'
import type { Folder } from '@/stores/file'

const props = defineProps<{
  path: Folder[]
}>()

const emit = defineEmits<{
  navigate: [folderId: string | null]
}>()
</script>

<template>
  <nav class="flex items-center gap-1 text-sm text-text-secondary">
    <button
      class="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-surface-2 hover:text-text-primary"
      @click="emit('navigate', null)"
    >
      <HomeIcon class="size-4" />
      <span>根目录</span>
    </button>
    <template v-for="(folder, idx) in props.path" :key="folder.id">
      <ChevronRightIcon class="size-4 text-text-tertiary" />
      <button
        class="rounded-lg px-2 py-1 hover:bg-surface-2 hover:text-text-primary"
        @click="emit('navigate', folder.id)"
      >
        {{ folder.name }}
      </button>
    </template>
  </nav>
</template>
