<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { KnowledgeBase } from '@/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PaperclipIcon, SendIcon, LoaderIcon } from 'lucide-vue-next'
import KbMentionDropdown from './KbMentionDropdown.vue'
import KbMentionPill from './KbMentionPill.vue'
import ModelSelector from './ModelSelector.vue'

const props = defineProps<{
  loading?: boolean
  disabled?: boolean
  disabledHint?: string
  knowledgeBases?: KnowledgeBase[]
  /** 当前对话标签绑定的模型（对齐设计稿底栏「model」芯片） */
  provider?: string
  model?: string
}>()

const emit = defineEmits<{
  send: [content: string, knowledgeBaseIds: string[]]
  modelChange: [provider: string, model: string]
}>()

const input = ref('')
const textareaRef = ref<InstanceType<typeof Textarea>>()
const isFocused = ref(false)
const selectedKbs = ref<KnowledgeBase[]>([])
const mentionQuery = ref('')
const mentionVisible = ref(false)
const mentionStart = ref(-1)

function autoResize() {
  const el = textareaRef.value?.$el as HTMLTextAreaElement | undefined
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
    const el = textareaRef.value?.$el as HTMLTextAreaElement | undefined
    mentionStart.value = el?.selectionStart ?? input.value.length
    mentionQuery.value = ''
    mentionVisible.value = true
  }
}

function handleInput() {
  if (!mentionVisible.value) return
  const el = textareaRef.value?.$el as HTMLTextAreaElement | undefined
  const cursor = el?.selectionStart ?? input.value.length
  if (cursor < mentionStart.value) {
    mentionVisible.value = false
    return
  }
  mentionQuery.value = input.value.slice(mentionStart.value + 1, cursor)
}

function onSelectKb(kb: KnowledgeBase) {
  if (selectedKbs.value.find((k) => k.id === kb.id)) return
  selectedKbs.value.push(kb)

  const el = textareaRef.value?.$el as HTMLTextAreaElement | undefined
  const before = input.value.slice(0, mentionStart.value)
  const after = input.value.slice(el?.selectionStart ?? input.value.length)
  input.value = before + after
  mentionVisible.value = false

  requestAnimationFrame(() => {
    if (el) {
      const pos = before.length
      el.setSelectionRange(pos, pos)
    }
    autoResize()
  })
}

function onCloseDropdown() {
  mentionVisible.value = false
}

function handleSend() {
  const content = extractPlainText()
  if (!content || props.loading || props.disabled) return
  emit('send', content, selectedKbs.value.map((k) => k.id))
  input.value = ''
  selectedKbs.value = []
  const el = textareaRef.value?.$el as HTMLTextAreaElement | undefined
  if (el) {
    el.style.height = 'auto'
  }
}

const dropdownRef = ref<InstanceType<typeof KbMentionDropdown>>()

const displayInput = computed(() => input.value)
</script>

<template>
  <!-- 设计稿「Bottom prompt」：最大宽 780、居中、圆角 24、内边距 [16,18]、阴影 blur≈38 -->
  <div data-testid="chat-input" class="shrink-0 bg-transparent px-4 pb-5 pt-2">
    <div class="mx-auto w-full max-w-[780px]">
      <div
        :class="[
          'relative flex flex-col gap-4 rounded-3xl border bg-white px-[18px] py-4 shadow-[0_16px_38px_rgba(0,0,0,0.08)] transition-all duration-200',
          isFocused
            ? 'border-accent-500/40 shadow-[0_16px_38px_rgba(0,0,0,0.08),0_0_0_3px_rgba(91,124,250,0.12)]'
            : 'border-border-default hover:border-border-default',
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
            <Textarea
              ref="textareaRef"
              v-model="input"
              :rows="1"
              class="max-h-40 resize-none border-0 bg-transparent text-[15px] leading-relaxed text-text-primary placeholder:text-text-tertiary shadow-none ring-0 focus-visible:ring-0 disabled:cursor-not-allowed"
              :placeholder="disabled ? (disabledHint || '发送不可用') : '继续追问，或让 AI 生成需求条目...'"
              :disabled="loading || disabled"
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

        <div class="flex items-end justify-between gap-3">
          <div class="flex min-w-0 flex-1 items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon-sm"
              class="h-[34px] w-[34px] rounded-[14px] bg-surface-2 hover:bg-surface-3"
              title="附件"
            >
              <PaperclipIcon class="size-4" />
            </Button>
            <ModelSelector
              :provider="provider"
              :model="model"
              variant="toolbar"
              @change="(p, m) => emit('modelChange', p, m)"
            />
          </div>

          <Button
            data-testid="chat-send-btn"
            :disabled="!displayInput.trim() || loading || disabled"
            class="h-[38px] w-[38px] rounded-2xl transition-all duration-200"
            :class="[
              displayInput.trim() && !loading && !disabled
                ? 'bg-accent-500 text-white hover:opacity-90 active:scale-95'
                : 'bg-surface-2 text-text-tertiary',
            ]"
            @click="handleSend"
          >
            <LoaderIcon v-if="loading" class="size-[17px] animate-spin" />
            <SendIcon v-else class="size-[17px]" />
          </Button>
        </div>
      </div>

      <div class="mt-2 flex items-center justify-between px-1">
        <p class="text-[11px] text-text-tertiary">
          AI 生成内容仅供参考
        </p>
        <p class="text-[11px] text-text-tertiary">
          {{ displayInput.length }} 字
        </p>
      </div>
    </div>
  </div>
</template>
