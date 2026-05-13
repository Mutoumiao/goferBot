<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useSessionStore } from '@/stores/session'

const store = useSessionStore()

const editingId = ref<string | null>(null)
const editValue = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)
const isSubmittingRename = ref(false)

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
  isSubmittingRename.value = false
  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

function confirmRename(id: string) {
  if (isSubmittingRename.value) return
  isSubmittingRename.value = true
  if (editValue.value.trim()) {
    store.renameSession(id, editValue.value)
  }
  editingId.value = null
}

function cancelRename() {
  editingId.value = null
}

function handleDelete(sessionId: string) {
  if (confirm('确定删除该会话？')) {
    store.deleteSession(sessionId)
  }
}
</script>

<template>
  <div class="h-full overflow-y-auto px-14 py-12">
    <div class="mx-auto max-w-[880px]">
      <!-- Header -->
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-[28px] font-medium text-text-primary">会话历史</h1>
          <p class="mt-1.5 text-sm text-text-secondary">点击任意记录即可恢复到对应会话，继续追问、整理或查看引用来源。</p>
        </div>
        <div class="flex items-center gap-2 rounded-[14px] border border-border-default bg-white/60 px-3 py-2">
          <span class="i-mdi-clock-outline text-sm text-text-tertiary" />
          <span class="text-sm text-text-secondary">全部会话</span>
          <span class="i-mdi-chevron-down text-sm text-text-tertiary" />
        </div>
      </div>

      <!-- Loading -->
      <div
        v-if="store.historyLoading"
        class="flex flex-col items-center justify-center py-20"
      >
        <span class="i-mdi-loading animate-spin text-3xl text-text-tertiary" />
        <p class="mt-4 text-sm text-text-secondary">加载中...</p>
      </div>

      <!-- Error -->
      <div
        v-else-if="store.historyError"
        class="flex flex-col items-center justify-center py-20"
      >
        <span class="i-mdi-alert-circle text-3xl text-danger-500" />
        <p class="mt-4 text-sm text-text-secondary">{{ store.historyError }}</p>
        <button
          class="mt-3 rounded-xl bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
          @click="store.loadHistory()"
        >
          重试
        </button>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="store.historySessions.length === 0"
        class="flex flex-col items-center justify-center py-20"
      >
        <span class="i-mdi-history text-4xl text-text-tertiary" />
        <p class="mt-4 text-text-secondary">暂无对话历史</p>
        <p class="mt-1 text-xs text-text-tertiary">开始一段新对话，历史将出现在这里</p>
      </div>

      <!-- List -->
      <div v-else class="space-y-2.5">
        <div
          v-for="session in store.historySessions"
          :key="session.id"
          class="group flex cursor-pointer items-center gap-3.5 rounded-[18px] border border-border-default bg-white p-4 transition-all hover:border-accent-500/20 hover:shadow-xs"
          @click="store.restoreSession(session.id)"
        >
          <div class="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-2xl bg-accent-soft">
            <span class="i-mdi-message-text-outline text-lg text-accent-500" />
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <input
                v-if="editingId === session.id"
                ref="editInputRef"
                v-model="editValue"
                class="h-7 rounded-lg border border-accent-500 bg-surface-1 px-2 text-sm font-medium text-text-primary outline-none"
                @keyup.enter="confirmRename(session.id)"
                @keyup.esc="cancelRename"
                @blur="confirmRename(session.id)"
                @click.stop
              />
              <h3
                v-else
                class="truncate text-[15px] font-medium text-text-primary"
              >
                {{ session.title }}
              </h3>
            </div>

            <div class="mt-1 flex items-center gap-2 text-xs text-text-tertiary">
              <span>{{ formatTime(session.updated_at) }}</span>
              <span v-if="session.message_count">· {{ session.message_count }} 条消息</span>
            </div>

            <p class="mt-1 line-clamp-1 text-sm text-text-secondary">
              {{ session.summary }}
            </p>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex flex-col items-end gap-0.5 text-xs text-text-tertiary">
              <span>{{ formatTime(session.updated_at) }}</span>
              <span v-if="session.message_count">{{ session.message_count }} 条消息</span>
            </div>
            <button
              class="flex h-[34px] w-[34px] items-center justify-center rounded-[14px] bg-surface-2 text-text-secondary opacity-0 transition-all group-hover:opacity-100 hover:bg-surface-3 hover:text-text-primary"
              title="恢复会话"
              @click.stop
            >
              <span class="i-mdi-arrow-right text-sm" />
            </button>
          </div>

          <div
            class="absolute right-4 hidden items-center gap-1 opacity-0 transition-opacity group-hover:flex group-hover:opacity-100"
          >
            <button
              class="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary"
              title="重命名"
              @click.stop="startRename(session.id, session.title)"
            >
              <span class="i-mdi-pencil text-sm" />
            </button>
            <button
              class="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-danger-soft hover:text-danger-500"
              title="删除"
              @click.stop="handleDelete(session.id)"
            >
              <span class="i-mdi-delete text-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
