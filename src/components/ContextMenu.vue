<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  visible: boolean
  x: number
  y: number
}>()

const emit = defineEmits<{
  close: []
}>()

function onClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  const menuEl = document.querySelector('[data-context-menu]')
  if (menuEl && !menuEl.contains(target)) {
    emit('close')
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
  }
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
  <Teleport to="body">
    <div
      v-if="visible"
      data-context-menu
      class="fixed z-50 min-w-[160px] rounded-lg border border-surface-3 bg-surface-1 py-1 shadow-xl"
      :style="{ left: `${x}px`, top: `${y}px` }"
      @click.stop
    >
      <slot />
    </div>
  </Teleport>
</template>
