<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  PlusIcon,
  PinIcon,
  PencilIcon,
  TrashIcon,
  LoaderIcon,
  DatabaseIcon,
  AlertCircleIcon,
  XIcon,
} from 'lucide-vue-next'

const store = useKnowledgeBaseStore()

onMounted(() => {
  store.loadKnowledgeBases()
})

// Create dialog
const showCreateDialog = ref(false)
const createName = ref('')
const createError = ref('')
const isCreating = ref(false)

function openCreateDialog() {
  createName.value = ''
  createError.value = ''
  showCreateDialog.value = true
}

async function confirmCreate() {
  if (isCreating.value) return
  const name = createName.value.trim()
  if (!name) {
    createError.value = '请输入知识库名称'
    return
  }
  isCreating.value = true
  try {
    await store.createKnowledgeBase(name)
    showCreateDialog.value = false
    createName.value = ''
    createError.value = ''
  } catch {
    createError.value = store.error || '创建失败'
    store.error = null
  } finally {
    isCreating.value = false
  }
}

// Rename dialog
const showRenameDialog = ref(false)
const renameId = ref('')
const renameName = ref('')
const renameError = ref('')
const isRenaming = ref(false)

function openRenameDialog(kb: { id: string; name: string }) {
  renameId.value = kb.id
  renameName.value = kb.name
  renameError.value = ''
  showRenameDialog.value = true
}

async function confirmRename() {
  if (isRenaming.value) return
  const name = renameName.value.trim()
  if (!name) {
    renameError.value = '名称不能为空'
    return
  }
  isRenaming.value = true
  try {
    await store.renameKnowledgeBase(renameId.value, name)
    showRenameDialog.value = false
    renameName.value = ''
    renameError.value = ''
  } catch {
    renameError.value = store.error || '重命名失败'
    store.error = null
  } finally {
    isRenaming.value = false
  }
}

// Delete confirmation
const showDeleteDialog = ref(false)
const deleteTarget = ref<{ id: string; name: string } | null>(null)
const isDeleting = ref(false)

function openDeleteDialog(kb: { id: string; name: string }) {
  deleteTarget.value = kb
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!deleteTarget.value || isDeleting.value) return
  isDeleting.value = true
  try {
    await store.deleteKnowledgeBase(deleteTarget.value.id)
    showDeleteDialog.value = false
    deleteTarget.value = null
  } catch {
    // error is set in store
  } finally {
    isDeleting.value = false
  }
}

// Dismiss store error
function dismissError() {
  store.error = null
}

const sortedKbs = computed(() => store.knowledgeBases)
</script>

<template>
  <div class="flex h-full flex-col bg-surface-1 px-10 py-8">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-semibold text-text-primary">知识库</h1>
      <Button
        class="gap-1.5 rounded-xl bg-accent-500 px-4 py-2 text-sm text-white hover:bg-accent-600"
        @click="openCreateDialog"
      >
        <PlusIcon class="size-4" />
        新建知识库
      </Button>
    </div>

    <!-- Loading -->
    <div v-if="store.isLoading && store.knowledgeBases.length === 0" class="flex flex-1 items-center justify-center">
      <LoaderIcon class="size-6 animate-spin text-accent-500" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="store.knowledgeBases.length === 0"
      class="flex flex-1 flex-col items-center justify-center gap-3 text-text-tertiary"
    >
      <DatabaseIcon class="size-12 opacity-40" />
      <p class="text-sm">暂无知识库</p>
      <Button variant="ghost" class="text-accent-500 hover:text-accent-600" @click="openCreateDialog">
        创建一个
      </Button>
    </div>

    <!-- KB Grid -->
    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <div
        v-for="kb in sortedKbs"
        :key="kb.id"
        class="group relative flex flex-col gap-3 rounded-2xl border border-border-default bg-white p-5 transition-all hover:shadow-md"
      >
        <!-- Top row: icon + actions -->
        <div class="flex items-start justify-between">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl"
            :class="kb.isPinned ? 'bg-accent-soft' : 'bg-surface-2'"
          >
            <DatabaseIcon
              class="size-5"
              :class="kb.isPinned ? 'text-accent-500' : 'text-text-tertiary'"
            />
          </div>
          <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon-xs"
              :class="kb.isPinned ? 'text-accent-500' : 'text-text-tertiary'"
              :title="kb.isPinned ? '取消置顶' : '置顶'"
              @click="store.togglePin(kb.id)"
            >
              <PinIcon class="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              class="text-text-tertiary"
              title="重命名"
              @click="openRenameDialog(kb)"
            >
              <PencilIcon class="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              class="text-text-tertiary hover:text-danger-500"
              title="删除"
              @click="openDeleteDialog(kb)"
            >
              <TrashIcon class="size-4" />
            </Button>
          </div>
        </div>

        <!-- Info -->
        <div class="min-w-0">
          <h3 class="truncate text-sm font-medium text-text-primary">{{ kb.name }}</h3>
          <p v-if="kb.description" class="mt-0.5 line-clamp-2 text-xs text-text-tertiary">
            {{ kb.description }}
          </p>
        </div>

        <!-- Meta -->
        <div class="mt-auto pt-2 text-[11px] text-text-tertiary">
          {{ new Date(kb.createdAt).toLocaleDateString('zh-CN') }}
        </div>
      </div>
    </div>

    <!-- Create Dialog -->
    <Dialog :open="showCreateDialog" @update:open="(v) => !v && (showCreateDialog = false)">
      <DialogContent class="w-96">
        <DialogHeader>
          <DialogTitle>新建知识库</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <Input
            v-model="createName"
            type="text"
            placeholder="输入知识库名称"
            class="rounded-xl border-border-default bg-surface-1 px-3 py-2.5 text-sm focus:border-accent-500/50"
            @keyup.enter="confirmCreate"
          />
          <p v-if="createError" class="text-xs text-danger-500">{{ createError }}</p>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            class="rounded-xl px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2"
            @click="showCreateDialog = false"
          >
            取消
          </Button>
          <Button
            class="rounded-xl bg-accent-500 px-3 py-1.5 text-sm text-white hover:bg-accent-600"
            :disabled="isCreating"
            @click="confirmCreate"
          >
            {{ isCreating ? '创建中...' : '创建' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Rename Dialog -->
    <Dialog :open="showRenameDialog" @update:open="(v) => !v && (showRenameDialog = false)">
      <DialogContent class="w-96">
        <DialogHeader>
          <DialogTitle>重命名知识库</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <Input
            v-model="renameName"
            type="text"
            placeholder="输入新名称"
            class="rounded-xl border-border-default bg-surface-1 px-3 py-2.5 text-sm focus:border-accent-500/50"
            @keyup.enter="confirmRename"
          />
          <p v-if="renameError" class="text-xs text-danger-500">{{ renameError }}</p>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            class="rounded-xl px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2"
            @click="showRenameDialog = false"
          >
            取消
          </Button>
          <Button
            class="rounded-xl bg-accent-500 px-3 py-1.5 text-sm text-white hover:bg-accent-600"
            :disabled="isRenaming"
            @click="confirmRename"
          >
            {{ isRenaming ? '保存中...' : '保存' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Dialog -->
    <Dialog :open="showDeleteDialog" @update:open="(v) => !v && (showDeleteDialog = false)">
      <DialogContent class="w-96">
        <DialogHeader>
          <DialogTitle>删除知识库</DialogTitle>
        </DialogHeader>
        <p class="text-sm text-text-secondary">
          确认删除知识库「<span class="font-medium text-text-primary">{{ deleteTarget?.name }}</span>」？此操作不可撤销。
        </p>
        <DialogFooter>
          <Button
            variant="ghost"
            class="rounded-xl px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2"
            @click="showDeleteDialog = false"
          >
            取消
          </Button>
          <Button
            class="rounded-xl bg-danger-500 px-3 py-1.5 text-sm text-white hover:bg-danger-600"
            :disabled="isDeleting"
            @click="confirmDelete"
          >
            {{ isDeleting ? '删除中...' : '删除' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

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
        class="absolute bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-danger-500/20 bg-white px-4 py-2.5 text-sm text-danger-500 shadow-xl"
      >
        <AlertCircleIcon class="size-4" />
        <span>{{ store.error }}</span>
        <Button variant="ghost" size="icon-xs" class="ml-1" @click="dismissError">
          <XIcon class="size-4" />
        </Button>
      </div>
    </Transition>
  </div>
</template>
