<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  name: string
  editing: boolean
}>()

const emit = defineEmits<{
  save: [newName: string]
  cancel: []
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const inputValue = ref('')

function getBaseName(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  return lastDot > 0 ? fileName.slice(0, lastDot) : fileName
}

watch(
  () => props.editing,
  (val) => {
    if (val) {
      inputValue.value = getBaseName(props.name)
      nextTick(() => {
        inputRef.value?.focus()
        inputRef.value?.select()
      })
    }
  },
  { immediate: true }
)

function onKeyup(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    emit('save', inputValue.value.trim())
  } else if (event.key === 'Escape') {
    emit('cancel')
  }
}

function onBlur() {
  emit('save', inputValue.value.trim())
}
</script>

<template>
  <input
    v-if="editing"
    ref="inputRef"
    v-model="inputValue"
    type="text"
    class="h-7 rounded-lg border border-accent-500 bg-white px-2 text-sm text-text-primary outline-none"
    @keyup="onKeyup"
    @blur="onBlur"
  />
</template>
