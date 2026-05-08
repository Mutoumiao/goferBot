<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { KnowledgeBase } from '@/types'
import KbMentionDropdown from './KbMentionDropdown.vue'
import KbMentionPill from './KbMentionPill.vue'

const props = defineProps<{
  loading?: boolean
  knowledgeBases?: KnowledgeBase[]
}>()

const emit = defineEmits<{
  send: [content: string, knowledgeBaseIds: string[]]
}>()

const input = ref('')
const textareaRef = ref<HTMLTextAreaElement>()
const isFocused = ref(false)
const selectedKbs = ref<KnowledgeBase[]>([])
const mentionQuery = ref('')
const mentionVisible = ref(false)
const mentionStart = ref(-1)

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 160) + 'px'
}

watch(input, autoResize)

function extractPlainText(): string {
  return input.value.trim()
}

function handleKeydown(e: KeyboardEvent) {
  if (mentionVisible.value) {
    dropdownRef.value?.handleKeydown(e)
    return
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  } else if (e.key === '@' && props.knowledgeBases && props.knowledgeBases.length > 0) {
    mentionStart.value = textareaRef.value?.selectionStart ?? input.value.length
    mentionQuery.value = ''
    mentionVisible.value = true
  }
}

function handleInput() {
  if (!mentionVisible.value) return
  const cursor = textareaRef.value?.selectionStart ?? input.value.length
  if (cursor < mentionStart.value) {
    mentionVisible.value = false
    return
  }
  mentionQuery.value = input.value.slice(mentionStart.value + 1, cursor)
}

function onSelectKb(kb: KnowledgeBase) {
  if (selectedKbs.value.find((k) => k.id === kb.id)) return
  selectedKbs.value.push(kb)

  const before = input.value.slice(0, mentionStart.value)
  const after = input.value.slice(textareaRef.value?.selectionStart ?? input.value.length)
  input.value = before + after
  mentionVisible.value = false

  requestAnimationFrame(() => {
    if (textareaRef.value) {
      const pos = before.length
      textareaRef.value.setSelectionRange(pos, pos)
    }
    autoResize()
  })
}

function onCloseDropdown() {
  mentionVisible.value = false
}

function handleSend() {
  const content = extractPlainText()
  if (!content || props.loading) return
  emit('send', content, selectedKbs.value.map((k) => k.id))
  input.value = ''
  selectedKbs.value = []
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
}

const dropdownRef = ref<InstanceType<typeof KbMentionDropdown>>()

const displayInput = computed(() => input.value)
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
      <div class="flex w-full flex-col gap-1.5">
        <div v-if="selectedKbs.length > 0" class="flex flex-wrap gap-1.5">
          <KbMentionPill
            v-for="kb in selectedKbs"
            :key="kb.id"
            :kb="kb"
            @remove="selectedKbs = selectedKbs.filter((k) => k.id !== kb.id)"
          />
        </div>
        <div class="relative">
          <textarea
            ref="textareaRef"
            v-model="input"
            rows="1"
            class="max-h-40 w-full resize-none bg-transparent text-sm leading-relaxed text-text-primary placeholder-text-tertiary outline-none"
            placeholder="输入问题，Shift + Enter 换行，Enter 发送，@提及知识库..."
            :disabled="loading"
            @keydown="handleKeydown"
            @input="handleInput"
            @focus="isFocused = true"
            @blur="isFocused = false"
          />
          <KbMentionDropdown
            ref="dropdownRef"
            :knowledge-bases="knowledgeBases ?? []"
            :query="mentionQuery"
            :visible="mentionVisible"
            @select="onSelectKb"
            @close="onCloseDropdown"
          />
        </div>
      </div>

      <button
        :disabled="!displayInput.trim() || loading"
        :class="[
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200',
          displayInput.trim() && !loading
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
        {{ displayInput.length }} 字
      </p>
    </div>
  </div>
</template>
