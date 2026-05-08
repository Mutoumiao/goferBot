<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'
import { confirmDialog } from '@/utils/confirm'
import FileExplorer from './FileExplorer.vue'
import ContextMenu from './ContextMenu.vue'
import EditKbDialog from './EditKbDialog.vue'
import MoveCopyDialog from './MoveCopyDialog.vue'

const store = useKnowledgeBaseStore()
const showNewKbDialog = ref(false)
const newKbName = ref('')
const newKbError = ref('')
const isCreatingKb = ref(false)

// Context menu state
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTargetKbId = ref<string | null>(null)

// Edit dialog
const showEditDialog = ref(false)
const editKbId = ref('')
const editKbName = ref('')
const editKbIcon = ref('')

// Auto rename after creating folder
const autoRenameFile = ref<string>()

// Move/Copy dialog
const moveCopyMode = ref<'move' | 'copy'>('move')
const moveCopyVisible = ref(false)
const moveCopySourceKbId = ref('')
const moveCopySourcePath = ref('')

onMounted(() => {
  store.loadKnowledgeBases()
})

const isSearchMode = computed(() => {
  const state = store.history[store.historyIndex]
  return state?.type === 'search'
})

function openNewKbDialog() {
  newKbName.value = ''
  newKbError.value = ''
  showNewKbDialog.value = true
}

async function confirmCreateKb() {
  if (isCreatingKb.value) return
  const name = newKbName.value.trim()
  if (!name) {
    newKbError.value = '请输入知识库名称'
    return
  }
  isCreatingKb.value = true
  try {
    await store.createKnowledgeBase(name)
    showNewKbDialog.value = false
    newKbName.value = ''
    newKbError.value = ''
  } catch {
    newKbError.value = store.error || '创建失败'
    store.error = null
  } finally {
    isCreatingKb.value = false
  }
}

// KB list context menu
function onKbContextMenu(event: MouseEvent, kbId: string) {
  event.preventDefault()
  contextMenuVisible.value = true
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuTargetKbId.value = kbId
}

function closeContextMenu() {
  contextMenuVisible.value = false
  contextMenuTargetKbId.value = null
}

function onPinKb() {
  if (contextMenuTargetKbId.value) {
    store.togglePin(contextMenuTargetKbId.value)
  }
  closeContextMenu()
}

function onEditKb() {
  const kb = store.knowledgeBases.find((k) => k.id === contextMenuTargetKbId.value)
  if (kb) {
    editKbId.value = kb.id
    editKbName.value = kb.name
    editKbIcon.value = kb.icon || 'mdi-database'
    showEditDialog.value = true
  }
  closeContextMenu()
}

async function onDeleteKb() {
  if (contextMenuTargetKbId.value) {
    const kb = store.knowledgeBases.find((k) => k.id === contextMenuTargetKbId.value)
    if (kb && (await confirmDialog(`确认将知识库「${kb.name}」移入回收站？`))) {
      await store.deleteKnowledgeBase(contextMenuTargetKbId.value)
    }
  }
  closeContextMenu()
}

async function onSaveEditKb(name: string, icon: string) {
  if (editKbId.value) {
    if (name !== editKbName.value) {
      await store.renameKnowledgeBase(editKbId.value, name)
    }
    if (icon !== editKbIcon.value) {
      await store.updateKbIcon(editKbId.value, icon)
    }
  }
  showEditDialog.value = false
}

function onOpenDirectory(path: string) {
  store.navigateToPath(path)
}

function onNavigateToBreadcrumb(index: number) {
  if (index === -1) {
    store.navigateToPath('')
    return
  }
  const path = store.breadcrumb.slice(0, index + 1).join('/')
  store.navigateToPath(path)
}

function onSearch(query: string) {
  if (!query.trim()) {
    store.searchQuery = ''
    store.navigateToPath('')
    return
  }
  store.searchFiles(query)
}

function onImportFiles() {
  store.importFiles()
}

async function onCreateFolder() {
  const defaultName = `未命名文件夹_${Date.now().toString().slice(-4)}`
  const createdName = await store.createFolder(defaultName)
  if (createdName) {
    autoRenameFile.value = createdName
  }
}

function onAutoRenameConsumed() {
  autoRenameFile.value = undefined
}

function onRenameFile(oldName: string, newName: string) {
  store.renameFile(oldName, newName)
}

function onDeleteFile(fileName: string) {
  store.deleteFile(fileName)
}

function onMoveFile(fileName: string) {
  moveCopyMode.value = 'move'
  moveCopySourceKbId.value = store.selectedKbId || ''
  moveCopySourcePath.value = store.currentPath ? `${store.currentPath}/${fileName}` : fileName
  moveCopyVisible.value = true
}

function onCopyFile(fileName: string) {
  moveCopyMode.value = 'copy'
  moveCopySourceKbId.value = store.selectedKbId || ''
  moveCopySourcePath.value = store.currentPath ? `${store.currentPath}/${fileName}` : fileName
  moveCopyVisible.value = true
}
</script>

<template>
  <div class="flex h-full bg-surface-0">
    <!-- Left sidebar: knowledge base list -->
    <div class="flex w-56 flex-col border-r border-surface-3">
      <div class="flex items-center justify-between border-b border-surface-3 px-3 py-3">
        <span class="text-sm font-medium text-text-primary">知识库</span>
        <button
          class="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
          @click="openNewKbDialog"
        >
          <span class="i-mdi-plus text-lg" />
        </button>
      </div>

      <div class="flex-1 overflow-auto p-2">
        <div
          v-for="kb in store.knowledgeBases"
          :key="kb.id"
          class="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 transition-colors"
          :class="store.selectedKbId === kb.id ? 'bg-accent-600/15 text-accent-400' : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'"
          @click="store.selectKb(kb.id)"
          @contextmenu="onKbContextMenu($event, kb.id)"
        >
          <span :class="`i-${kb.icon || 'mdi-database'} text-lg`" />
          <span class="truncate text-sm">{{ kb.name }}</span>
        </div>

        <div v-if="store.knowledgeBases.length === 0 && !store.isLoading" class="px-2 py-4 text-center text-xs text-text-tertiary">
          暂无知识库，点击 + 创建
        </div>
      </div>
    </div>

    <!-- Right: file explorer -->
    <div class="flex-1">
      <FileExplorer
        v-if="store.selectedKb"
        :files="store.files"
        :search-results="store.searchResults"
        :search-query="store.searchQuery"
        :breadcrumb="store.breadcrumb"
        :is-search-mode="isSearchMode"
        :is-loading="store.isLoading"
        :auto-rename-item="autoRenameFile"
        @open-directory="onOpenDirectory"
        @navigate-to-breadcrumb="onNavigateToBreadcrumb"
        @search="onSearch"
        @import-files="onImportFiles"
        @go-back="store.goBack"
        @go-forward="store.goForward"
        @create-folder="onCreateFolder"
        @rename-file="onRenameFile"
        @move-file="onMoveFile"
        @copy-file="onCopyFile"
        @delete-file="onDeleteFile"
        @auto-rename-consumed="onAutoRenameConsumed"
      />
      <div v-else class="flex h-full flex-col items-center justify-center gap-3 text-text-tertiary">
        <span class="i-mdi-bookshelf text-5xl" />
        <span class="text-sm">选择一个知识库或创建新库</span>
      </div>
    </div>

    <!-- KB Context Menu -->
    <ContextMenu
      :visible="contextMenuVisible"
      :x="contextMenuX"
      :y="contextMenuY"
      @close="closeContextMenu"
    >
      <div class="py-1">
        <button class="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary" @click="onPinKb">
          <span class="i-mdi-pin text-sm" />
          <span>置顶</span>
        </button>
        <button class="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary" @click="onEditKb">
          <span class="i-mdi-pencil text-sm" />
          <span>修改资料</span>
        </button>
        <div class="my-1 border-t border-surface-3" />
        <button class="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10" @click="onDeleteKb">
          <span class="i-mdi-delete text-sm" />
          <span>移入回收站</span>
        </button>
      </div>
    </ContextMenu>

    <!-- Edit KB Dialog -->
    <EditKbDialog
      :visible="showEditDialog"
      :initial-name="editKbName"
      :initial-icon="editKbIcon"
      @close="showEditDialog = false"
      @save="onSaveEditKb"
    />

    <!-- Move/Copy Dialog -->
    <MoveCopyDialog
      :visible="moveCopyVisible"
      :mode="moveCopyMode"
      :source-kb-id="moveCopySourceKbId"
      :source-path="moveCopySourcePath"
      @close="moveCopyVisible = false"
    />

    <!-- New KB Dialog -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showNewKbDialog"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          @click.self="showNewKbDialog = false"
        >
          <div class="w-80 rounded-lg border border-surface-3 bg-surface-1 p-5 shadow-xl">
            <h3 class="mb-3 text-base font-medium text-text-primary">新建知识库</h3>
            <input
              v-model="newKbName"
              type="text"
              placeholder="输入知识库名称"
              class="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-text-primary placeholder-text-tertiary outline-none transition-colors focus:border-accent-500"
              @keyup.enter="confirmCreateKb"
            />
            <p v-if="newKbError" class="mt-2 text-xs text-red-400">{{ newKbError }}</p>
            <div class="mt-4 flex justify-end gap-2">
              <button class="rounded-md px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary" @click="showNewKbDialog = false">取消</button>
              <button
              class="rounded-md bg-accent-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-accent-500 disabled:opacity-50"
              :disabled="isCreatingKb"
              @click="confirmCreateKb"
            >
              {{ isCreatingKb ? '创建中...' : '创建' }}
            </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Error toast -->
    <Transition name="fade">
      <div
        v-if="store.error"
        class="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400"
      >
        <span class="i-mdi-alert-circle-outline" />
        {{ store.error }}
        <button class="ml-1 text-red-400 hover:text-red-300" @click="store.error = null">
          <span class="i-mdi-close" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
