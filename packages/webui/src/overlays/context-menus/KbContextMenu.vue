<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { defineContextMenu } from '@/overlays'
import { PinIcon, PencilIcon, TrashIcon } from 'lucide-vue-next'

interface KbItem {
  id: string
  name: string
  isPinned?: boolean
}

const props = defineProps<{
  x: number
  y: number
  kb: KbItem
  onAction?: (action: 'pin' | 'rename' | 'delete', kb: KbItem) => void
}>()

const { close } = defineContextMenu()

const menuRef = ref<HTMLElement | null>(null)

const position = computed(() => {
  const menuWidth = menuRef.value?.offsetWidth ?? 160
  const menuHeight = menuRef.value?.offsetHeight ?? 160
  const left = Math.max(0, Math.min(props.x, window.innerWidth - menuWidth))
  const top = Math.max(0, Math.min(props.y, window.innerHeight - menuHeight))
  return { left: `${left}px`, top: `${top}px` }
})

function handleAction(action: 'pin' | 'rename' | 'delete') {
  props.onAction?.(action, props.kb)
  close()
}

function onClickOutside(event: MouseEvent) {
  // 忽略右键点击（contextmenu 事件由调用方处理）
  if (event.button !== 0) return
  const target = event.target as HTMLElement
  if (menuRef.value && !menuRef.value.contains(target)) {
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
    <button
      class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
      @click="handleAction('pin')"
    >
      <PinIcon class="size-4" />
      {{ kb.isPinned ? '取消置顶' : '置顶' }}
    </button>
    <button
      class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
      @click="handleAction('rename')"
    >
      <PencilIcon class="size-4" />
      编辑
    </button>
    <button
      class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger-500 hover:bg-danger-50"
      @click="handleAction('delete')"
    >
      <TrashIcon class="size-4" />
      删除
    </button>
  </div>
</template>
