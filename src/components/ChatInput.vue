<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  loading?: boolean
}>()

const emit = defineEmits<{
  send: [content: string]
}>()

const input = ref('')
const textareaRef = ref<HTMLTextAreaElement>()

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 128) + 'px'
}

watch(input, autoResize)

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function handleSend() {
  const content = input.value.trim()
  if (!content || props.loading) return
  emit('send', content)
  input.value = ''
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
}
</script>

<template>
  <div class="border-t border-gray-700 bg-gray-800 p-4">
    <div class="relative flex items-end gap-2 rounded-xl border border-gray-600 bg-gray-700 px-3 py-2">
      <textarea
        ref="textareaRef"
        v-model="input"
        rows="1"
        class="max-h-32 w-full resize-none bg-transparent text-sm text-gray-200 placeholder-gray-400 outline-none"
        placeholder="输入问题，Shift + Enter 换行，Enter 发送..."
        :disabled="loading"
        @keydown="handleKeydown"
      />
      <button
        :disabled="!input.trim() || loading"
        class="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        @click="handleSend"
      >
        发送
      </button>
    </div>
  </div>
</template>
