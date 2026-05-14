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

const indexProgress = computed(() => {
  const status = store.selectedKbId ? store.indexStatus.get(store.selectedKbId) : undefined
  if (!status || status.totalFiles === 0) return 0
  return Math.round((status.indexedFiles / status.totalFiles) * 100)
})

async function onSelectKb(id: string) {
  await store.selectKb(id)
  await store.loadIndexStatus(id)
}

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
    if (kb && (await confirmDialog(`确认将知识库「${kb.name}」移入回收站？`, { title: '提示', kind: 'warning' }))) {
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
  <!-- 设计稿「03 知识库」：工作区内边距 [30,40]、双栏间距 28、左侧列表宽 286 -->
  <div class="flex h-full min-h-0 gap-7 bg-surface-1 px-10 py-[30px]">
    <aside class="flex h-full min-h-0 w-[286px] shrink-0 flex-col gap-[18px]">
      <div class="flex items-center justify-between">
        <span class="text-[22px] font-medium leading-tight text-text-primary">知识库</span>
        <button
          data-testid="create-kb-btn"
          type="button"
          class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[14px] border border-border-default bg-white text-text-secondary shadow-[0_1px_4px_rgba(0,0,0,0.03)] transition-colors hover:bg-surface-2 hover:text-text-primary"
          title="新建知识库"
          @click="openNewKbDialog"
        >
          <span class="i-mdi-plus text-lg" />
        </button>
      </div>

      <div
        class="flex h-11 items-center gap-2.5 rounded-2xl border border-border-default bg-white px-3.5 py-2.5"
      >
        <span class="i-mdi-magnify shrink-0 text-base text-text-tertiary" />
        <input
          type="text"
          placeholder="搜索知识库"
          class="min-w-0 flex-1 bg-transparent text-[13px] text-text-primary placeholder-text-tertiary outline-none"
          @keyup.enter="onSearch(($event.target as HTMLInputElement).value)"
        />
      </div>

      <div data-testid="kb-list" class="flex min-h-0 flex-1 flex-col gap-3 overflow-auto pr-0.5">
        <div
          v-for="kb in store.knowledgeBases"
          :key="kb.id"
          data-testid="kb-item"
          class="flex min-h-[86px] cursor-pointer items-center gap-3 rounded-[20px] border px-4 py-4 transition-all"
          :class="store.selectedKbId === kb.id
            ? 'border-border-default bg-white text-text-primary shadow-[0_1px_4px_rgba(0,0,0,0.03)]'
            : 'border-transparent bg-white/55 hover:border-border-default/80 hover:bg-white/90'"
          @click="onSelectKb(kb.id)"
          @contextmenu="onKbContextMenu($event, kb.id)"
        >
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px]"
            :class="store.selectedKbId === kb.id ? 'bg-accent-soft' : 'bg-surface-2'"
          >
            <span
              class="text-base"
              :class="[
                `i-${kb.icon || 'mdi-database'}`,
                store.selectedKbId === kb.id ? 'text-accent-500' : 'text-text-tertiary'
              ]"
            />
          </div>
          <div class="flex min-w-0 flex-col gap-0.5">
            <span class="truncate text-sm font-medium">{{ kb.name }}</span>
            <span class="text-xs text-text-tertiary">{{ (kb as any).fileCount || 0 }} 个文件</span>
          </div>
        </div>
      </div>
    </aside>

    <div class="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-surface-1">
      <FileExplorer
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

      <!-- Index progress -->
      <div
        v-if="indexProgress > 0 && indexProgress < 100"
        class="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border-default bg-white px-4 py-2 shadow-lg"
      >
        <span class="i-mdi-loading animate-spin text-sm text-accent-500" />
        <span class="text-xs text-text-secondary">正在索引文件... {{ indexProgress }}%</span>
      </div>
    </div>

    <!-- Context Menu -->
    <ContextMenu
      :visible="contextMenuVisible"
      :x="contextMenuX"
      :y="contextMenuY"
      @close="closeContextMenu"
    >
      <button
        class="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
        @click="onPinKb"
      >
        <span class="i-mdi-pin text-sm" />
        <span>置顶</span>
      </button>
      <button
        class="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
        @click="onEditKb"
      >
        <span class="i-mdi-pencil text-sm" />
        <span>编辑</span>
      </button>
      <div class="my-1 border-t border-border-default" />
      <button
        class="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger-500 transition-colors hover:bg-danger-soft"
        @click="onDeleteKb"
      >
        <span class="i-mdi-delete text-sm" />
        <span>删除</span>
      </button>
    </ContextMenu>

    <!-- New KB Dialog -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showNewKbDialog"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          @click.self="showNewKbDialog = false"
        >
          <div class="w-80 rounded-3xl border border-border-default bg-white p-5 shadow-xl">
            <h3 class="mb-4 text-base font-medium text-text-primary">新建知识库</h3>
            <input
              v-model="newKbName"
              type="text"
              placeholder="输入知识库名称"
              class="w-full rounded-xl border border-border-default bg-surface-1 px-3 py-2.5 text-sm text-text-primary placeholder-text-tertiary outline-none transition-colors focus:border-accent-500/50"
              @keyup.enter="confirmCreateKb"
            />
            <p v-if="newKbError" class="mt-2 text-xs text-danger-500">{{ newKbError }}</p>
            <div class="mt-4 flex justify-end gap-2">
              <button
                class="rounded-xl px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-2"
                @click="showNewKbDialog = false"
              >
                取消
              </button>
              <button
                class="rounded-xl bg-accent-500 px-3 py-1.5 text-sm text-white transition-colors hover:bg-accent-600"
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

    <!-- Edit Dialog -->
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
  </div>
</template>
