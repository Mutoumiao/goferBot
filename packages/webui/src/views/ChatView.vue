<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import { useSessionStore } from '@/stores/session'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SendIcon, LoaderIcon, AlertCircleIcon, XIcon } from 'lucide-vue-next'
import EmptySession from '@/components/EmptySession.vue'
import ChatMessageList from '@/components/ChatMessageList.vue'

const store = useSessionStore()

const isEmpty = computed(() => !store.activeSessionId && store.activeMessages.length === 0)

const input = ref('')
const textareaRef = ref<InstanceType<typeof Textarea>>()

function handleSend(content: string) {
  input.value = ''
  store.sendMessage(content)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSendFromInput()
  }
}

function handleSendFromInput() {
  const content = input.value.trim()
  if (!content || store.isLoading) return
  input.value = ''
  store.sendMessage(content)
}

// Auto-dismiss toast after 5s
const toastTimer = ref<ReturnType<typeof setTimeout> | null>(null)
watch(() => store.error, (err) => {
  if (err) {
    if (toastTimer.value) clearTimeout(toastTimer.value)
    toastTimer.value = setTimeout(() => {
      store.error = null
    }, 5000)
  }
})

function dismissToast() {
  if (toastTimer.value) clearTimeout(toastTimer.value)
  store.error = null
}
</script>

<template>
  <div class="flex h-full flex-col bg-surface-1">
    <EmptySession v-if="isEmpty" @send="handleSend" />

    <template v-else>
      <!-- Top bar: session title -->
      <div class="shrink-0 border-b border-border-default bg-white px-5 py-3">
        <h1 class="mx-auto max-w-[760px] text-sm font-medium text-text-primary">
          {{ store.activeSession?.title ?? '新会话' }}
        </h1>
      </div>

      <!-- Message list -->
      <ChatMessageList :messages="store.activeMessages" :is-sending="store.isLoading" />

      <!-- Bottom input -->
      <div class="shrink-0 bg-transparent px-4 pb-5 pt-2">
        <div class="mx-auto w-full max-w-[780px]">
          <div
            class="relative flex flex-col gap-4 rounded-3xl border border-border-default bg-white px-[18px] py-4 shadow-[0_16px_38px_rgba(0,0,0,0.08)] transition-all duration-200"
          >
            <Textarea
              ref="textareaRef"
              v-model="input"
              :rows="1"
              class="max-h-40 resize-none border-0 bg-transparent text-[15px] leading-relaxed text-text-primary placeholder:text-text-tertiary shadow-none ring-0 focus-visible:ring-0"
              placeholder="继续追问，或让 AI 生成需求条目..."
              :disabled="store.isLoading"
              @keydown="handleKeydown"
            />
            <div class="flex items-end justify-between gap-3">
              <div class="flex min-w-0 flex-1 items-center gap-2.5" />
              <Button
                data-testid="chat-send-btn"
                :disabled="!input.trim() || store.isLoading"
                class="h-[38px] w-[38px] rounded-2xl transition-all duration-200"
                :class="[
                  input.trim() && !store.isLoading
                    ? 'bg-accent-500 text-white hover:opacity-90 active:scale-95'
                    : 'bg-surface-2 text-text-tertiary',
                ]"
                @click="handleSendFromInput"
              >
                <LoaderIcon v-if="store.isLoading" class="size-[17px] animate-spin" />
                <SendIcon v-else class="size-[17px]" />
              </Button>
            </div>
          </div>

          <div class="mt-2 flex items-center justify-between px-1">
            <p class="text-[11px] text-text-tertiary">AI 生成内容仅供参考</p>
            <p class="text-[11px] text-text-tertiary">{{ input.length }} 字</p>
          </div>
        </div>
      </div>
    </template>

    <!-- Error toast -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="store.error"
        class="absolute bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-danger-500/20 bg-white px-4 py-2.5 text-sm text-danger-500 shadow-xl"
      >
        <AlertCircleIcon class="size-4" />
        <span>{{ store.error }}</span>
        <Button variant="ghost" size="icon-xs" class="ml-1" @click="dismissToast">
          <XIcon data-icon="inline-start" />
        </Button>
      </div>
    </Transition>
  </div>
</template>
