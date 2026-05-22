<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { defineContextMenu } from '@/overlays'
import { FolderPlusIcon, PencilIcon, FolderInputIcon, CopyIcon, Trash2Icon } from 'lucide-vue-next'

const props = defineProps<{
  x: number
  y: number
  fileName: string | null
  onAction?: (action: 'rename' | 'move' | 'copy' | 'delete' | 'createFolder', fileName?: string) => void
}>()

const { close } = defineContextMenu()

const isBackground = computed(() => props.fileName === null)

const menuRef = ref<HTMLElement | null>(null)

const position = computed(() => {
  const menuWidth = menuRef.value?.offsetWidth ?? 160
  const menuHeight = menuRef.value?.offsetHeight ?? 200
  const left = Math.max(0, Math.min(props.x, window.innerWidth - menuWidth))
  const top = Math.max(0, Math.min(props.y, window.innerHeight - menuHeight))
  return { left: `${left}px`, top: `${top}px` }
})

function handleAction(action: 'rename' | 'move' | 'copy' | 'delete' | 'createFolder') {
  if (action === 'createFolder') {
    props.onAction?.('createFolder', undefined)
  } else if (props.fileName) {
    props.onAction?.(action, props.fileName)
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
    <template v-else>
      <button
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
        @click="handleAction('rename')"
      >
        <PencilIcon class="size-4" />
        重命名
      </button>
      <button
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
        @click="handleAction('move')"
      >
        <FolderInputIcon class="size-4" />
        移动
      </button>
      <button
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
        @click="handleAction('copy')"
      >
        <CopyIcon class="size-4" />
        复制
      </button>
      <div class="my-1 h-px bg-border-default" />
      <button
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger-500 hover:bg-danger-50"
        @click="handleAction('delete')"
      >
        <Trash2Icon class="size-4" />
        删除
      </button>
    </template>
  </div>
  <div data-testid="context-menu-overlay" class="fixed inset-0 z-40" @click="close" />
</template>
