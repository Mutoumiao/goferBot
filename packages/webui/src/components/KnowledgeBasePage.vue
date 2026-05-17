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
import FileManager from './knowledge-base/FileManager.vue'
import ContextMenu from './ContextMenu.vue'

const store = useKnowledgeBaseStore()

onMounted(() => {
  store.loadKnowledgeBases()
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN')
}

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
  closeContextMenu()
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
  closeContextMenu()
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

// Context menu
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTarget = ref<{ id: string; name: string } | null>(null)

function openContextMenu(event: MouseEvent, kb: { id: string; name: string }) {
  event.preventDefault()
  event.stopPropagation()
  contextMenuTarget.value = kb
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuVisible.value = true
}

function closeContextMenu() {
  contextMenuVisible.value = false
  contextMenuTarget.value = null
}

function togglePinFromMenu() {
  if (contextMenuTarget.value) {
    store.togglePin(contextMenuTarget.value.id)
  }
  closeContextMenu()
}

// Dismiss store error
function dismissError() {
  store.error = null
}

const selectedKbId = ref<string | null>(null)
const selectedKb = computed(() =>
  store.knowledgeBases.find((kb) => kb.id === selectedKbId.value),
)

function selectKb(kb: { id: string; name: string }) {
  selectedKbId.value = kb.id
}

const sortedKbs = computed(() => store.knowledgeBases)
</script>

<template>
  <div class="flex h-full bg-surface-1">
    <!-- Left sidebar: KB List -->
    <div data-testid="kb-list" class="flex w-72 flex-col border-r border-border-default bg-white">
      <div class="flex items-center justify-between px-4 py-3">
        <h2 class="text-sm font-semibold text-text-primary">知识库</h2>
        <Button data-testid="create-kb-btn" variant="ghost" size="icon-xs" @click="openCreateDialog">
          <PlusIcon class="size-4" />
        </Button>
      </div>

      <!-- Loading -->
      <div
        v-if="store.isLoading && store.knowledgeBases.length === 0"
        class="flex flex-1 items-center justify-center"
      >
        <LoaderIcon class="size-6 animate-spin text-accent-500" />
      </div>

      <!-- Empty -->
      <div
        v-else-if="store.knowledgeBases.length === 0"
        class="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-text-tertiary"
      >
        <DatabaseIcon class="size-8 opacity-40" />
        <p class="text-xs">暂无知识库</p>
      </div>

      <!-- List -->
      <div v-else class="flex-1 overflow-auto px-2">
        <div
          v-for="kb in sortedKbs"
          :key="kb.id"
          data-testid="kb-item"
          class="group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 transition-colors"
          :class="
            selectedKbId === kb.id
              ? 'bg-accent-500/10 text-accent-600'
              : 'hover:bg-surface-2'
          "
          @click="selectKb(kb)"
          @contextmenu="openContextMenu($event, kb)"
        >
          <DatabaseIcon
            class="size-4"
            :class="kb.isPinned ? 'text-accent-500' : 'text-text-tertiary'"
          />
          <span class="flex-1 truncate text-sm">{{ kb.name }}</span>
          <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon-xs"
              :class="kb.isPinned ? 'text-accent-500' : 'text-text-tertiary'"
              @click.stop="store.togglePin(kb.id)"
            >
              <PinIcon class="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              class="text-text-tertiary"
              @click.stop="openRenameDialog(kb)"
            >
              <PencilIcon class="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              class="text-text-tertiary hover:text-danger-500"
              @click.stop="openDeleteDialog(kb)"
            >
              <TrashIcon class="size-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Right: File Manager -->
    <div class="flex-1">
      <FileManager :kb-id="selectedKbId" />
    </div>

    <!-- Context Menu -->
    <ContextMenu
      :visible="contextMenuVisible"
      :x="contextMenuX"
      :y="contextMenuY"
      @close="closeContextMenu"
    >
      <Button
        variant="ghost"
        size="sm"
        class="flex w-full items-center justify-start gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-2"
        @click="togglePinFromMenu"
      >
        <PinIcon class="size-4" />
        {{ contextMenuTarget?.isPinned ? '取消置顶' : '置顶' }}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        class="flex w-full items-center justify-start gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-2"
        @click="contextMenuTarget && openRenameDialog(contextMenuTarget)"
      >
        <PencilIcon class="size-4" />
        编辑
      </Button>
      <Button
        variant="ghost"
        size="sm"
        class="flex w-full items-center justify-start gap-2 px-3 py-2 text-sm text-danger-500 hover:bg-danger-soft"
        @click="contextMenuTarget && openDeleteDialog(contextMenuTarget)"
      >
        <TrashIcon class="size-4" />
        删除
      </Button>
    </ContextMenu>

    <!-- Create Dialog -->
    <Dialog :open="showCreateDialog" @update:open="(v) => !v && (showCreateDialog = false)">
      <DialogContent class="w-96" data-testid="create-dialog">
        <DialogHeader>
          <DialogTitle>新建知识库</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <Input
            v-model="createName"
            data-testid="kb-name-input"
            type="text"
            placeholder="输入知识库名称"
            class="rounded-xl border-border-default bg-surface-1 px-3 py-2.5 text-sm focus:border-accent-500/50"
            @keyup.enter="confirmCreate"
          />
          <p v-if="createError" class="text-xs text-danger-500" data-testid="create-error">{{ createError }}</p>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            data-testid="create-cancel-btn"
            class="rounded-xl px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2"
            @click="showCreateDialog = false"
          >
            取消
          </Button>
          <Button
            data-testid="kb-create-confirm"
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
      <DialogContent class="w-96" data-testid="rename-dialog">
        <DialogHeader>
          <DialogTitle>重命名知识库</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <Input
            v-model="renameName"
            data-testid="rename-name-input"
            type="text"
            placeholder="输入新名称"
            class="rounded-xl border-border-default bg-surface-1 px-3 py-2.5 text-sm focus:border-accent-500/50"
            @keyup.enter="confirmRename"
          />
          <p v-if="renameError" class="text-xs text-danger-500" data-testid="rename-error">{{ renameError }}</p>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            data-testid="rename-cancel-btn"
            class="rounded-xl px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2"
            @click="showRenameDialog = false"
          >
            取消
          </Button>
          <Button
            data-testid="rename-confirm-btn"
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
      <DialogContent class="w-96" data-testid="delete-dialog">
        <DialogHeader>
          <DialogTitle>删除知识库</DialogTitle>
        </DialogHeader>
        <p class="text-sm text-text-secondary" data-testid="confirm-dialog">
          确认删除知识库「<span class="font-medium text-text-primary">{{ deleteTarget?.name }}</span>」？此操作不可撤销。
        </p>
        <DialogFooter>
          <Button
            variant="ghost"
            data-testid="delete-cancel-btn"
            class="rounded-xl px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2"
            @click="showDeleteDialog = false"
          >
            取消
          </Button>
          <Button
            data-testid="delete-confirm-btn"
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
