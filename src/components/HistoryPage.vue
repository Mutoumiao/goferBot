<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useSessionStore } from '@/stores/session'

const store = useSessionStore()

const editingId = ref<string | null>(null)
const editValue = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)

onMounted(() => {
  store.loadHistory()
})

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function startRename(id: string, title: string) {
  editingId.value = id
  editValue.value = title
  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

function confirmRename(id: string) {
  if (editValue.value.trim()) {
    store.renameSession(id, editValue.value)
  }
  editingId.value = null
}

function cancelRename() {
  editingId.value = null
}
</script>

<template>
  <div class="h-full overflow-y-auto p-6">
    <div class="mx-auto max-w-3xl">
      <!-- Tabs -->
      <div class="mb-6 flex gap-2 border-b border-border-default">
        <button
          class="border-b-2 border-accent-500 px-3 py-2 text-sm font-medium text-accent-400"
        >
          问答历史
        </button>
      </div>

      <!-- Empty state -->
      <div
        v-if="store.historySessions.length === 0"
        class="flex flex-col items-center justify-center py-20"
      >
        <span class="i-mdi-history text-4xl text-text-tertiary" />
        <p class="mt-4 text-text-secondary">暂无对话历史</p>
        <p class="mt-1 text-xs text-text-tertiary">开始一段新对话，历史将出现在这里</p>
      </div>

      <!-- List -->
      <div v-else class="space-y-2">
        <div
          v-for="session in store.historySessions"
          :key="session.id"
          class="group flex cursor-pointer items-start gap-3 rounded-xl border border-border-default bg-surface-1 p-4 transition-all hover:border-accent-500/30 hover:bg-surface-2"
          @click="store.restoreSession(session.id)"
        >
          <span class="i-mdi-chat-outline mt-0.5 text-lg text-text-tertiary" />

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <input
                v-if="editingId === session.id"
                ref="editInputRef"
                v-model="editValue"
                class="h-7 rounded border border-accent-500 bg-surface-0 px-2 text-sm font-medium text-text-primary outline-none"
                @keyup.enter="confirmRename(session.id)"
                @keyup.esc="cancelRename"
                @blur="confirmRename(session.id)"
                @click.stop
              />
              <h3
                v-else
                class="truncate text-sm font-medium text-text-primary"
              >
                {{ session.title }}
              </h3>
            </div>

            <div class="mt-1 flex items-center gap-2 text-xs text-text-tertiary">
              <span>{{ formatTime(session.updated_at) }}</span>
              <span v-if="session.message_count">· {{ session.message_count }} 条消息</span>
            </div>

            <p class="mt-1 line-clamp-2 text-sm text-text-secondary">
              {{ session.summary }}
            </p>
          </div>

          <div
            class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <button
              class="rounded p-1.5 text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-primary"
              title="重命名"
              @click.stop="startRename(session.id, session.title)"
            >
              <span class="i-mdi-pencil text-sm" />
            </button>
            <button
              class="rounded p-1.5 text-text-tertiary transition-colors hover:bg-danger-500/10 hover:text-danger-400"
              title="删除"
              @click.stop="store.deleteSession(session.id)"
            >
              <span class="i-mdi-delete text-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
