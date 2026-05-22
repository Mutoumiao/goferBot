<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { defineContextMenu } from '@/overlays'
import { FolderPlusIcon, FolderIcon, PencilIcon, TrashIcon } from 'lucide-vue-next'
import type { DocumentItem, Folder } from '@/stores/file'

const props = defineProps<{
  x: number
  y: number
  item: (DocumentItem | Folder) | null
  onAction?: (action: 'open' | 'rename' | 'delete' | 'createFolder', item?: DocumentItem | Folder) => void
}>()

const { close } = defineContextMenu()

const isFolder = computed(() => props.item !== null && !('status' in props.item))
const isDocument = computed(() => props.item !== null && 'status' in props.item)
const isBackground = computed(() => props.item === null)

const menuRef = ref<HTMLElement | null>(null)

const position = computed(() => {
  const menuWidth = menuRef.value?.offsetWidth ?? 160
  const menuHeight = menuRef.value?.offsetHeight ?? 200
  const left = Math.max(0, Math.min(props.x, window.innerWidth - menuWidth))
  const top = Math.max(0, Math.min(props.y, window.innerHeight - menuHeight))
  return { left: `${left}px`, top: `${top}px` }
})

function handleAction(action: 'open' | 'rename' | 'delete' | 'createFolder') {
  if (action === 'createFolder') {
    props.onAction?.('createFolder', undefined)
  } else if (props.item) {
    props.onAction?.(action, props.item)
  }
  close()
}

function onClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  const menuEl = document.querySelector('[data-testid="context-menu"]')
  if (menuEl && !menuEl.contains(target)) {
    close()
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    ref="menuRef"
    data-testid="context-menu"
    class="fixed z-50 min-w-[160px] rounded-lg border border-border-default bg-white py-1 shadow-xl"
    :style="position"
    @click.stop
  >
    <template v-if="isBackground">
      <button
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
        @click="handleAction('createFolder')"
      >
        <FolderPlusIcon class="size-4" />
        新建文件夹
      </button>
    </template>
    <template v-else-if="item">
      <button
        v-if="isFolder || isDocument"
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
        @click="handleAction('open')"
      >
        <FolderIcon class="size-4" />
        打开
      </button>
      <button
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
        @click="handleAction('rename')"
      >
        <PencilIcon class="size-4" />
        重命名
      </button>
      <div class="my-1 h-px bg-border-default" />
      <button
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger-500 hover:bg-danger-50"
        @click="handleAction('delete')"
      >
        <TrashIcon class="size-4" />
        删除
      </button>
    </template>
  </div>
  <div data-testid="context-menu-overlay" class="fixed inset-0 z-40" @click="close" />
</template>
