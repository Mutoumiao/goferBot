<script setup lang="ts">
import { computed } from 'vue'
import { FolderIcon, FileTextIcon, FileIcon } from 'lucide-vue-next'
import type { DocumentItem, Folder } from '@/stores/file'

const props = defineProps<{
  item: DocumentItem | Folder
  isSelected?: boolean
}>()

const emit = defineEmits<{
  open: []
  select: [add: boolean]
  contextmenu: [event: MouseEvent]
}>()

const isFolder = computed(() => !('status' in props.item))
const isDocument = computed(() => 'status' in props.item)

const statusColor = computed(() => {
  if (isFolder.value) return ''
  const s = (props.item as DocumentItem).status
  switch (s) {
    case 'ready': return 'bg-success-500 text-white'
    case 'failed': return 'bg-danger-500 text-white'
    case 'uploaded': return 'bg-text-tertiary text-white'
    default: return 'bg-accent-500 text-white'
  }
})

const statusLabel = computed(() => {
  if (isFolder.value) return ''
  const map: Record<string, string> = {
    uploaded: '已上传', parsing: '解析中', chunking: '分块中',
    indexing: '索引中', ready: '就绪', failed: '失败',
  }
  return map[(props.item as DocumentItem).status] ?? ''
})

const fileIcon = computed(() => {
  if (isFolder.value) return FolderIcon
  const ext = (props.item as DocumentItem).ext?.toLowerCase()
  if (ext === 'md' || ext === 'txt') return FileTextIcon
  return FileIcon
})

function handleClick(e: MouseEvent) {
  if (e.ctrlKey || e.metaKey) {
    emit('select', true)
  } else {
    emit('open')
  }
}

function handleDblClick() {
  emit('open')
}
</script>

<template>
  <div
    class="group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 transition-all hover:border-accent-500/30 hover:bg-surface-2"
    :class="isSelected ? 'border-accent-500 bg-accent-500/5' : 'border-border-default bg-white'"
    @click="handleClick"
    @dblclick="handleDblClick"
    @contextmenu.prevent="emit('contextmenu', $event)"
  >
    <component :is="fileIcon" class="size-10 text-text-tertiary group-hover:text-accent-500" />
    <span class="max-w-full truncate text-xs text-text-primary">{{ item.name }}</span>
    <span
      v-if="isDocument && statusLabel"
      class="absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
      :class="statusColor"
    >
      {{ statusLabel }}
    </span>
  </div>
</template>
