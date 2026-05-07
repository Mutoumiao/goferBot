<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import EmptySession from './EmptySession.vue'
import ChatMessageList from './ChatMessageList.vue'
import ChatInput from './ChatInput.vue'

const store = useSessionStore()
const settings = useSettingsStore()

const isEmpty = computed(() => !store.activeTab?.sessionId && store.activeMessages.length === 0)

function handleSend(content: string) {
  store.sendMessage(content, settings.llmConfig)
}
</script>

<template>
  <div class="flex h-full flex-col">
    <EmptySession v-if="isEmpty" @send="handleSend" />
    <template v-else>
      <ChatMessageList :messages="store.activeMessages" />
      <ChatInput :loading="store.isSending" @send="handleSend" />
    </template>

    <div
      v-if="store.sendError"
      class="border-t border-red-800 bg-red-900/30 px-4 py-2 text-sm text-red-300"
    >
      {{ store.sendError }}
    </div>
  </div>
</template>
