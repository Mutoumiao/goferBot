<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  SparklesIcon,
  FileTextIcon,
  FolderSearchIcon,
  Wand2Icon,
  PaperclipIcon,
  DatabaseIcon,
  SendIcon,
} from 'lucide-vue-next'

const emit = defineEmits<{
  send: [content: string, knowledgeBaseIds?: string[]]
}>()

const input = ref('')

const quickActions = [
  {
    icon: FileTextIcon,
    iconColor: 'text-accent-500',
    iconBg: 'bg-accent-soft',
    title: '总结文档',
    caption: '提炼重点与行动项',
  },
  {
    icon: FolderSearchIcon,
    iconColor: 'text-success-500',
    iconBg: 'bg-success-soft',
    title: '查找资料',
    caption: '跨知识库引用来源',
  },
  {
    icon: Wand2Icon,
    iconColor: 'text-purple-500',
    iconBg: 'bg-purple-soft',
    title: '生成笔记',
    caption: '把零散信息变成结构',
  },
]

function handleSend() {
  const content = input.value.trim()
  if (!content) return
  emit('send', content, [])
  input.value = ''
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}

function sendQuick(content: string) {
  emit('send', content, [])
}
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center bg-surface-1">
    <div class="flex w-[760px] flex-col items-center gap-[34px]">
      <!-- Hero Logo：58×58、圆角 22、设计稿阴影 offset y=8 blur=24 -->
      <div
        class="flex h-[58px] w-[58px] items-center justify-center rounded-[22px] border border-border-default bg-white shadow-[0_8px_24px_rgba(0,0,0,0.05)]"
      >
        <SparklesIcon class="size-[26px] text-accent-500" />
      </div>

      <!-- Headline -->
      <h2
        class="w-[720px] text-center text-[34px] font-medium leading-[1.18] tracking-tight text-text-primary"
      >
        今天想从知识库里理解什么？
      </h2>

      <!-- Prompt input：宽 760、圆角 24、内边距 [18,20]、子项间距 18、设计稿大阴影 blur=42 y=18 -->
      <div
        data-testid="empty-session-input"
        class="flex min-h-[150px] w-full flex-col gap-[18px] rounded-3xl border border-border-default bg-white px-5 py-[18px] shadow-[0_18px_42px_rgba(0,0,0,0.07)]"
      >
        <Textarea
          data-testid="chat-input"
          v-model="input"
          :rows="2"
          class="resize-none border-0 bg-transparent text-base leading-relaxed text-text-primary placeholder:text-text-tertiary shadow-none ring-0 focus-visible:ring-0"
          placeholder="询问、总结或让 AI 帮你整理桌面资料..."
          @keydown="handleKeydown"
        />
        <div class="flex items-end justify-between">
          <div class="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon-sm"
              class="h-[34px] w-[34px] rounded-[14px] bg-surface-2 hover:bg-surface-3"
              title="附件"
            >
              <PaperclipIcon class="size-4" />
            </Button>
            <Button
              data-testid="chat-kb-btn"
              variant="ghost"
              size="sm"
              class="h-[34px] gap-1.5 rounded-[14px] bg-surface-2 px-3 text-sm text-text-secondary hover:bg-surface-3"
              title="知识库"
            >
              <DatabaseIcon class="size-4" />
              <span>知识库</span>
            </Button>
          </div>
          <Button
            data-testid="chat-send-btn"
            class="h-[38px] w-[38px] rounded-2xl bg-accent-500 text-white transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-40"
            :disabled="!input.trim()"
            @click="handleSend"
          >
            <SendIcon class="size-[17px]" />
          </Button>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="flex w-full gap-[18px]">
        <Button
          v-for="action in quickActions"
          :key="action.title"
          variant="ghost"
          class="group flex flex-1 items-center gap-3 rounded-[18px] border border-border-default bg-white/75 p-[18px] text-left transition-all duration-200 hover:border-accent-500/30 hover:bg-white hover:shadow-sm"
          @click="sendQuick(action.title)"
        >
          <div
            class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[13px]"
            :class="action.iconBg"
          >
            <Component :is="action.icon" class="size-4" :class="action.iconColor" />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-sm font-normal text-text-primary">{{ action.title }}</span>
            <span class="text-xs text-text-tertiary">{{ action.caption }}</span>
          </div>
        </Button>
      </div>
    </div>
  </div>
</template>
