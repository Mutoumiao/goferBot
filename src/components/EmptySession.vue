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
    <div class="w-full max-w-2xl space-y-8">
      <h2 class="text-center text-2xl font-semibold text-gray-100">
        有什么可以帮你的？
      </h2>

      <div class="relative">
        <textarea
          v-model="input"
          rows="3"
          class="w-full resize-none rounded-xl border border-gray-600 bg-gray-700 p-4 pr-16 text-gray-200 placeholder-gray-400 outline-none transition-colors focus:border-blue-500"
          placeholder="输入你的问题..."
          @keydown.enter.prevent="handleSend"
        />
        <button
          class="absolute bottom-3 right-3 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          :disabled="!input.trim()"
          @click="handleSend"
        >
          发送
        </button>
      </div>

      <div class="flex flex-wrap justify-center gap-2">
        <button
          v-for="q in quickQuestions"
          :key="q"
          class="rounded-full border border-gray-600 bg-gray-700/50 px-4 py-1.5 text-sm text-gray-300 transition-colors hover:border-blue-500 hover:text-blue-400"
          @click="sendQuick(q)"
        >
          {{ q }}
        </button>
      </div>
    </div>
  </div>
</template>
