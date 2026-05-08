<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'
import EmptySession from './EmptySession.vue'
import ChatMessageList from './ChatMessageList.vue'
import ChatInput from './ChatInput.vue'

const store = useSessionStore()
const settings = useSettingsStore()
const kbStore = useKnowledgeBaseStore()

const isEmpty = computed(() => !store.activeTab?.sessionId && store.activeMessages.length === 0)

function handleSend(content: string, knowledgeBaseIds?: string[]) {
  store.sendMessage(content, settings.llmConfig, knowledgeBaseIds)
}

onMounted(() => {
  if (kbStore.knowledgeBases.length === 0) {
    kbStore.loadKnowledgeBases()
  }
})
</script>

<template>
  <div class="flex h-full flex-col">
    <EmptySession v-if="isEmpty" @send="handleSend" />
    <template v-else>
      <ChatMessageList :messages="store.activeMessages" />
      <ChatInput
        :loading="store.isSending"
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
      </div>
    </Transition>
  </div>
</template>
