<script setup lang="ts">
import { computed, onMounted, watch, ref } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'
import EmptySession from './EmptySession.vue'
import ChatMessageList from './ChatMessageList.vue'
import ChatInput from './ChatInput.vue'
import ModelSelector from './ModelSelector.vue'

const store = useSessionStore()
const settings = useSettingsStore()
const kbStore = useKnowledgeBaseStore()

const isEmpty = computed(() => !store.activeTab?.sessionId && store.activeMessages.length === 0)

const currentProvider = computed(() => store.activeTab?.provider)
const currentModel = computed(() => store.activeTab?.model)

function handleSend(content: string, knowledgeBaseIds?: string[]) {
  const cfg = store.activeTab?.provider
    ? settings.getLLMConfig(store.activeTab.provider)
    : settings.getLLMConfig()
  if (!cfg) {
    store.sendError = '未配置可用的 LLM 提供商，请前往设置'
    return
  }
  store.sendMessage(content, cfg, knowledgeBaseIds)
}

function handleRetry() {
  const msgs = store.activeMessages
  const lastUserMsg = [...msgs].reverse().find((m) => m.role === 'user')
  if (!lastUserMsg) return
  const cfg = store.activeTab?.provider
    ? settings.getLLMConfig(store.activeTab.provider)
    : settings.getLLMConfig()
  if (!cfg) {
    store.sendError = '未配置可用的 LLM 提供商，请前往设置'
    return
  }
  const kbIds: string[] | undefined = lastUserMsg.knowledge_base_ids
    ? JSON.parse(lastUserMsg.knowledge_base_ids)
    : undefined
  store.sendMessage(lastUserMsg.content, cfg, kbIds)
}

function handleModelChange(provider: string, model: string) {
  const idx = store.tabs.findIndex((t) => t.id === store.activeTabId)
  if (idx !== -1) {
    store.tabs[idx].provider = provider
    store.tabs[idx].model = model
  }
}

function handleTitleBlur(e: FocusEvent) {
  const target = e.target as HTMLInputElement
  const idx = store.tabs.findIndex((t) => t.id === store.activeTabId)
  if (idx !== -1) {
    store.tabs[idx].title = target.value.trim() || store.tabs[idx].title
  }
}

onMounted(() => {
  if (kbStore.knowledgeBases.length === 0) {
    kbStore.loadKnowledgeBases()
  }
})

// Auto-dismiss toast after 5s
const toastTimer = ref<ReturnType<typeof setTimeout> | null>(null)
watch(() => store.sendError, (err) => {
  if (err) {
    if (toastTimer.value) clearTimeout(toastTimer.value)
    toastTimer.value = setTimeout(() => {
      store.sendError = null
    }, 5000)
  }
})

function dismissToast() {
  if (toastTimer.value) clearTimeout(toastTimer.value)
  store.sendError = null
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Top bar -->
    <div
      v-if="!isEmpty"
      class="flex h-12 shrink-0 items-center justify-between border-b border-border-default bg-surface-1 px-4"
    >
      <input
        :value="store.activeTab?.title ?? '首页'"
        class="bg-transparent text-sm font-medium text-text-primary outline-none"
        @blur="handleTitleBlur"
      />
      <ModelSelector
        :provider="currentProvider"
        :model="currentModel"
        @change="handleModelChange"
      />
    </div>

    <EmptySession v-if="isEmpty" @send="handleSend" />
    <template v-else>
      <ChatMessageList :messages="store.activeMessages" :is-sending="store.isSending" @retry="handleRetry" />
      <ChatInput
        :loading="store.isSending"
        :disabled="!settings.getLLMConfig()"
        disabled-hint="未配置 LLM 模型，请前往设置"
        :knowledge-bases="kbStore.knowledgeBases"
        @send="handleSend"
      />
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
        v-if="store.sendError"
        class="absolute bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-danger-500/20 bg-surface-2 px-4 py-2.5 text-sm text-danger-400 shadow-xl"
      >
        <span class="i-mdi-alert-circle text-base" />
        <span>{{ store.sendError }}</span>
        <button class="ml-1 text-text-tertiary hover:text-text-primary" @click="dismissToast">
          <span class="i-mdi-close text-xs" />
        </button>
      </div>
    </Transition>
  </div>
</template>
