<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch, ref } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'
import { isSidecarReady } from '@/utils/sidecarClient'
import EmptySession from './EmptySession.vue'
import ChatMessageList from './ChatMessageList.vue'
import ChatInput from './ChatInput.vue'

const store = useSessionStore()
const settings = useSettingsStore()
const kbStore = useKnowledgeBaseStore()

const isEmpty = computed(() => !store.activeTab?.sessionId && store.activeMessages.length === 0)

const currentProvider = computed(() => store.activeTab?.provider)
const currentModel = computed(() => store.activeTab?.model)

const sidecarReady = ref(false)
const inputDisabled = computed(() => !sidecarReady.value || !settings.getLLMConfig())
const inputDisabledHint = computed(() => {
  if (!sidecarReady.value) return 'Sidecar 服务未就绪'
  if (!settings.getLLMConfig()) return '未配置 LLM 模型，请前往设置'
  return ''
})

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

let sidecarTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  if (kbStore.knowledgeBases.length === 0) {
    kbStore.loadKnowledgeBases()
  }
  isSidecarReady().then((ready) => {
    sidecarReady.value = ready
  })
  sidecarTimer = setInterval(async () => {
    sidecarReady.value = await isSidecarReady()
  }, 5000)
})

onUnmounted(() => {
  if (sidecarTimer) clearInterval(sidecarTimer)
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
  <div class="flex h-full flex-col bg-surface-1">
    <EmptySession v-if="isEmpty" @send="handleSend" />
    <template v-else>
      <ChatMessageList :messages="store.activeMessages" :is-sending="store.isSending" @retry="handleRetry" />
      <ChatInput
        :loading="store.isSending"
        :disabled="inputDisabled"
        :disabled-hint="inputDisabledHint"
        :knowledge-bases="kbStore.knowledgeBases"
        :provider="currentProvider"
        :model="currentModel"
        @send="handleSend"
        @model-change="handleModelChange"
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
        class="absolute bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-danger-500/20 bg-white px-4 py-2.5 text-sm text-danger-500 shadow-xl"
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
