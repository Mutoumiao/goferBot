<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  send: [content: string]
}>()

const input = ref('')

const quickQuestions = [
  '什么是 RAG 检索增强生成？',
  '如何导入 Markdown 文档？',
  '本地知识库的工作原理是什么？',
  '支持哪些大语言模型？',
]

function handleSend() {
  const content = input.value.trim()
  if (!content) return
  emit('send', content)
  input.value = ''
}

function sendQuick(content: string) {
  emit('send', content)
}
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center p-8">
    <div class="w-full max-w-2xl space-y-10">
      <!-- Brand mark + Title -->
      <div class="space-y-4 text-center">
        <div
          class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-500/10 shadow-lg shadow-accent-glow"
        >
          <span class="i-mdi-brain text-3xl text-accent-400" />
        </div>
        <h2
          class="text-3xl font-semibold tracking-tight"
          style="background: linear-gradient(135deg, #e8eaf0 0%, #60a5fa 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;"
        >
          有什么可以帮你的？
        </h2>
        <p class="text-sm text-text-secondary">
          基于本地知识库的智能问答助手
        </p>
      </div>

      <!-- Input -->
      <div class="relative">
        <textarea
          v-model="input"
          rows="3"
          class="w-full resize-none rounded-2xl border border-border-default bg-surface-2 p-4 pr-14 text-text-primary placeholder-text-tertiary outline-none transition-all duration-200 focus:border-accent-500/50 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
          placeholder="输入你的问题..."
          @keydown.enter.prevent="handleSend"
        />
        <button
          class="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-xl bg-accent-500 text-white shadow-lg shadow-accent-glow transition-all duration-200 hover:bg-accent-400 active:scale-95 disabled:opacity-40 disabled:shadow-none"
          :disabled="!input.trim()"
          @click="handleSend"
        >
          <span class="i-mdi-arrow-up text-base" />
        </button>
      </div>

      <!-- Quick Questions -->
      <div class="space-y-3">
        <p class="text-center text-xs font-medium uppercase tracking-wider text-text-tertiary">
          快捷提问
        </p>
        <div class="flex flex-wrap justify-center gap-2">
          <button
            v-for="q in quickQuestions"
            :key="q"
            class="rounded-lg border border-border-subtle bg-surface-2 px-4 py-2 text-sm text-text-secondary transition-all duration-200 hover:border-accent-500/30 hover:bg-surface-3 hover:text-accent-400"
            @click="sendQuick(q)"
          >
            {{ q }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
