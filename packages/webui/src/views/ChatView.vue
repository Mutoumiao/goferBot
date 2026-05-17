<script setup lang="ts">
import { computed, watch, ref, onMounted } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useChatTabsStore } from '@/stores/chatTabs'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'
import { useSettingsStore } from '@/stores/settings'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SendIcon, LoaderIcon, AlertCircleIcon, XIcon } from 'lucide-vue-next'
import EmptySession from '@/components/EmptySession.vue'
import ChatMessageList from '@/components/ChatMessageList.vue'
import TabBar from '@/components/TabBar.vue'
import ChatInput from '@/components/ChatInput.vue'

const sessionStore = useSessionStore()
const chatTabsStore = useChatTabsStore()
const kbStore = useKnowledgeBaseStore()
const settingsStore = useSettingsStore()

const isEmpty = computed(() => !sessionStore.activeSessionId && sessionStore.activeMessages.length === 0)

function handleSend(content: string, knowledgeBaseIds: string[]) {
  const llmConfig = settingsStore.getLLMConfig()
  sessionStore.sendMessage(content, knowledgeBaseIds, {
    llmConfig,
    onNewSession(sessionId, title) {
      chatTabsStore.updateHomeTabSession(sessionId, title)
    },
  })
}

onMounted(() => {
  kbStore.loadKnowledgeBases()
})

// Auto-dismiss toast after 5s
const toastTimer = ref<ReturnType<typeof setTimeout> | null>(null)
watch(() => sessionStore.error, (err) => {
  if (err) {
    if (toastTimer.value) clearTimeout(toastTimer.value)
    toastTimer.value = setTimeout(() => {
      sessionStore.error = null
    }, 5000)
  }
})

function dismissToast() {
  if (toastTimer.value) clearTimeout(toastTimer.value)
  sessionStore.error = null
}

// Tab handlers
function onTabSwitch(tabId: string) {
  chatTabsStore.switchTab(tabId)
  const tab = chatTabsStore.activeTab
  if (tab?.sessionId) {
    sessionStore.loadSession(tab.sessionId)
  } else {
    sessionStore.activeSessionId = null
  }
}

async function onNewChat() {
  const session = await sessionStore.createSession()
  chatTabsStore.addTab(session.id, session.title || '新会话')
}

function onTabClose(tabId: string) {
  chatTabsStore.closeTab(tabId)
  const tab = chatTabsStore.activeTab
  if (tab?.sessionId) {
    sessionStore.loadSession(tab.sessionId)
  } else {
    sessionStore.activeSessionId = null
  }
}

async function onTabRename(tabId: string, title: string) {
  const tab = chatTabsStore.tabs.find((t) => t.id === tabId)
  if (tab?.sessionId) {
    await sessionStore.renameSession(tab.sessionId, title)
  }
  chatTabsStore.renameTab(tabId, title)
}
</script>

<template>
  <div class="flex h-full flex-col bg-surface-1">
    <TabBar
      :tabs="chatTabsStore.tabs"
      :active-tab-id="chatTabsStore.activeTabId"
      @switch="onTabSwitch"
      @close="onTabClose"
      @new-chat="onNewChat"
      @rename="onTabRename"
    />

    <EmptySession v-if="isEmpty" @send="handleSend" />

    <template v-else>
      <!-- Top bar: session title -->
      <div class="shrink-0 border-b border-border-default bg-white px-5 py-3">
        <h1 class="mx-auto max-w-[760px] text-sm font-medium text-text-primary">
          {{ sessionStore.activeSession?.title ?? '新会话' }}
        </h1>
      </div>

      <!-- Message list -->
      <ChatMessageList :messages="sessionStore.activeMessages" :is-sending="sessionStore.isLoading" />

      <!-- Bottom input -->
      <ChatInput
        :knowledge-bases="kbStore.knowledgeBases"
        :loading="sessionStore.isLoading"
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
        v-if="sessionStore.error"
        class="absolute bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-danger-500/20 bg-white px-4 py-2.5 text-sm text-danger-500 shadow-xl"
      >
        <AlertCircleIcon class="size-4" />
        <span>{{ sessionStore.error }}</span>
        <Button variant="ghost" size="icon-xs" class="ml-1" @click="dismissToast">
          <XIcon data-icon="inline-start" />
        </Button>
      </div>
    </Transition>
  </div>
</template>
