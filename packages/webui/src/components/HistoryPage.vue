<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ClockIcon,
  LoaderIcon,
  AlertCircleIcon,
  HistoryIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
  ArrowRightIcon,
  SearchIcon,
} from 'lucide-vue-next'

const store = useSessionStore()
const router = useRouter()

const editingId = ref<string | null>(null)
const editValue = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)
const isSubmittingRename = ref(false)

const openMenuId = ref<string | null>(null)
const searchQuery = ref('')
const showDeleteDialog = ref(false)
const deleteTargetId = ref('')
const isDeleting = ref(false)

const menuRef = ref<HTMLDivElement | null>(null)

onMounted(() => {
  if (store.sessions.length === 0) {
    store.loadSessions()
  }
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

function handleClickOutside(e: MouseEvent) {
  const target = e.target as Node
  if (menuRef.value && !menuRef.value.contains(target)) {
    openMenuId.value = null
  }
}

function closeMenu() {
  openMenuId.value = null
}

function toggleMenu(id: string, e: Event) {
  e.stopPropagation()
  openMenuId.value = openMenuId.value === id ? null : id
}

const filteredSessions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return store.sessions
  return store.sessions.filter((s) => s.title.toLowerCase().includes(q))
})

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const day = 86400000
  const diff = startOf(now) - startOf(d)
  const hm = d.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (diff === 0) return `今天 ${hm}`
  if (diff === day) return `昨天 ${hm}`
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

function startRename(id: string, title: string) {
  openMenuId.value = null
  editingId.value = id
  editValue.value = title
  isSubmittingRename.value = false
  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

async function confirmRename(id: string) {
  if (isSubmittingRename.value) return
  isSubmittingRename.value = true
  const trimmed = editValue.value.trim()
  if (trimmed && trimmed !== store.sessions.find((s) => s.id === id)?.title) {
    await store.renameSession(id, trimmed)
  }
  editingId.value = null
  isSubmittingRename.value = false
}

function cancelRename() {
  editingId.value = null
  isSubmittingRename.value = false
}

function handleRenameKeydown(e: KeyboardEvent, id: string) {
  if (e.key === 'Enter') {
    e.preventDefault()
    confirmRename(id)
  } else if (e.key === 'Escape') {
    cancelRename()
  }
}

function openDeleteDialog(id: string) {
  openMenuId.value = null
  deleteTargetId.value = id
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!deleteTargetId.value || isDeleting.value) return
  isDeleting.value = true
  try {
    await store.deleteSession(deleteTargetId.value)
    showDeleteDialog.value = false
    deleteTargetId.value = ''
  } finally {
    isDeleting.value = false
  }
}

function onRowClick(sessionId: string) {
  openMenuId.value = null
  store.loadSession(sessionId)
  router.push('/')
}
</script>

<template>
  <div class="flex h-full flex-col bg-surface-1 px-10 py-8">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-semibold text-text-primary">对话历史</h1>
      <div
        class="flex h-10 items-center gap-2.5 rounded-2xl border border-border-default bg-white px-3.5 py-2"
      >
        <SearchIcon class="size-4 shrink-0 text-text-tertiary" />
        <Input
          v-model="searchQuery"
          type="text"
          placeholder="搜索会话"
          class="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-text-primary placeholder:text-text-tertiary shadow-none focus-visible:ring-0"
        />
      </div>
    </div>

    <!-- Loading -->
    <div
      v-if="store.isLoading && store.sessions.length === 0"
      class="flex flex-1 items-center justify-center"
    >
      <LoaderIcon class="size-6 animate-spin text-accent-500" />
    </div>

    <!-- Error -->
    <div
      v-else-if="store.error && store.sessions.length === 0"
      class="flex flex-1 flex-col items-center justify-center gap-3"
    >
      <AlertCircleIcon class="size-8 text-danger-500" />
      <p class="text-sm text-text-secondary">{{ store.error }}</p>
      <Button
        class="rounded-2xl bg-accent-500 px-4 py-2 text-sm text-white hover:bg-accent-600"
        @click="store.loadSessions()"
      >
        重试
      </Button>
    </div>

    <!-- Empty -->
    <div
      v-else-if="filteredSessions.length === 0"
      class="flex flex-1 flex-col items-center justify-center gap-2 text-text-tertiary"
    >
      <HistoryIcon class="size-10 opacity-80" />
      <p class="text-sm text-text-secondary">
        {{ searchQuery ? '未找到匹配的会话' : '暂无对话历史' }}
      </p>
      <p v-if="!searchQuery" class="text-xs">开始一段新对话，历史将出现在这里</p>
    </div>

    <!-- List -->
    <div v-else class="flex flex-col gap-2.5">
      <div
        v-for="session in filteredSessions"
        :key="session.id"
        class="group relative flex cursor-pointer items-center gap-3.5 rounded-[18px] border border-border-default bg-white px-4 py-3.5 transition-all hover:bg-surface-1"
        @click="onRowClick(session.id)"
      >
        <!-- Icon -->
        <div class="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-2xl bg-accent-soft">
          <MessageSquareIcon class="size-[19px] text-accent-500" />
        </div>

        <!-- Main content -->
        <div class="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-[5px]">
          <div class="min-w-0">
            <Input
              v-if="editingId === session.id"
              ref="editInputRef"
              v-model="editValue"
              class="h-8 w-full rounded-lg border-accent-500 bg-surface-1 px-2 text-[15px] font-medium text-text-primary"
              @keydown="handleRenameKeydown($event, session.id)"
              @blur="confirmRename(session.id)"
              @click.stop
            />
            <h3 v-else class="truncate text-[15px] font-medium text-text-primary">
              {{ session.title }}
            </h3>
          </div>
          <p class="text-xs text-text-secondary">
            {{ session.messageCount }} 条消息
          </p>
        </div>

        <!-- Meta -->
        <div class="hidden w-[170px] shrink-0 flex-col items-end justify-center gap-[5px] text-xs text-text-tertiary sm:flex">
          <span>{{ formatTime(session.updatedAt) }}</span>
        </div>

        <!-- Actions -->
        <div class="flex shrink-0 items-center gap-1.5" @click.stop>
          <div ref="menuRef" class="relative">
            <Button
              variant="ghost"
              size="icon-sm"
              class="h-[34px] w-[34px] rounded-[14px] text-text-tertiary hover:bg-surface-2 hover:text-text-secondary sm:opacity-0 sm:group-hover:opacity-100"
              :class="openMenuId === session.id ? 'bg-surface-2 opacity-100' : ''"
              @click="toggleMenu(session.id, $event)"
            >
              <MoreHorizontalIcon class="size-5" />
            </Button>
            <div
              v-if="openMenuId === session.id"
              class="absolute right-0 top-[calc(100%+4px)] z-20 min-w-[120px] rounded-xl border border-border-default bg-white py-1 shadow-lg"
              @click.stop
            >
              <Button
                variant="ghost"
                size="sm"
                class="flex w-full items-center justify-start gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-2"
                @click="startRename(session.id, session.title)"
              >
                <PencilIcon class="size-4" />
                重命名
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="flex w-full items-center justify-start gap-2 px-3 py-2 text-sm text-danger-500 hover:bg-danger-soft"
                @click="openDeleteDialog(session.id)"
              >
                <TrashIcon class="size-4" />
                删除
              </Button>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            class="h-[34px] w-[34px] rounded-[14px] bg-surface-2 text-text-secondary hover:bg-surface-3"
            @click="onRowClick(session.id)"
          >
            <ArrowRightIcon class="size-[15px]" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Delete Dialog -->
    <div
      v-if="showDeleteDialog"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      @click="showDeleteDialog = false"
    >
      <div class="w-96 rounded-2xl bg-white p-6 shadow-xl" @click.stop>
        <h3 class="text-lg font-medium text-text-primary">删除会话</h3>
        <p class="mt-2 text-sm text-text-secondary">确认删除该会话？此操作不可撤销。</p>
        <div class="mt-4 flex justify-end gap-2">
          <Button variant="ghost" @click="showDeleteDialog = false">取消</Button>
          <Button
            class="bg-danger-500 text-white hover:bg-danger-600"
            :disabled="isDeleting"
            @click="confirmDelete"
          >
            {{ isDeleting ? '删除中...' : '删除' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
