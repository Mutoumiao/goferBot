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
const isFocused = ref(false)

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 160) + 'px'
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
  <div class="border-t border-border-default bg-surface-1 p-4">
    <div
      :class="[
        'relative flex items-end gap-2 rounded-xl border bg-surface-2 px-3 py-2.5 transition-all duration-200',
        isFocused
          ? 'border-accent-500/50 shadow-[0_0_0_3px_rgba(59,130,246,0.1)]'
          : 'border-border-default hover:border-border-default/80',
      ]"
    >
      <textarea
        ref="textareaRef"
        v-model="input"
        rows="1"
        class="max-h-40 w-full resize-none bg-transparent text-sm leading-relaxed text-text-primary placeholder-text-tertiary outline-none"
        placeholder="输入问题，Shift + Enter 换行，Enter 发送..."
        :disabled="loading"
        @keydown="handleKeydown"
        @focus="isFocused = true"
        @blur="isFocused = false"
      />

      <button
        :disabled="!input.trim() || loading"
        :class="[
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200',
          input.trim() && !loading
            ? 'bg-accent-500 text-white shadow-lg shadow-accent-glow hover:bg-accent-400 active:scale-95'
            : 'bg-surface-4 text-text-tertiary',
        ]"
        @click="handleSend"
      >
        <span
          :class="[
            loading ? 'i-mdi-loading animate-spin' : 'i-mdi-send',
            'text-sm',
          ]"
        />
      </button>
    </div>

    <div class="mt-1.5 flex items-center justify-between px-1">
      <p class="text-[11px] text-text-tertiary">
        AI 生成内容仅供参考
      </p>
      <p class="text-[11px] text-text-tertiary">
        {{ input.length }} 字
      </p>
    </div>
  </div>
</template>
