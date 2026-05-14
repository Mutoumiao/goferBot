<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { confirmDialog } from '@/utils/confirm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { FileItem, SearchResultItem } from '@/types'
import ContextMenu from './ContextMenu.vue'
import InlineRename from './InlineRename.vue'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  PlusIcon,
  LoaderIcon,
  FolderOpenIcon,
  FolderIcon,
  FileTextIcon,
  FolderPlusIcon,
  FolderInputIcon,
  CopyIcon,
  Trash2Icon,
  PencilIcon,
} from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  files: FileItem[]
  searchResults: SearchResultItem[]
  searchQuery: string
  breadcrumb: string[]
  isSearchMode: boolean
  isLoading: boolean
  autoRenameItem?: string
}>(), {
  files: () => [],
  searchResults: () => [],
})

const emit = defineEmits<{
  openDirectory: [path: string]
  navigateToBreadcrumb: [index: number]
  search: [query: string]
  importFiles: []
  goBack: []
  goForward: []
  createFolder: []
  renameFile: [oldName: string, newName: string]
  moveFile: [fileName: string]
  copyFile: [fileName: string]
  deleteFile: [fileName: string]
  autoRenameConsumed: []
}>()

const displayItems = computed(() => {
  if (props.isSearchMode) {
    return props.searchResults.map((r) => ({
      ...r,
      displayPath: r.relativePath,
    }))
  }
  return props.files.map((f) => ({ ...f, displayPath: f.name }))
})

function onItemClick(item: FileItem | SearchResultItem) {
  if (item.type === 'directory') {
    if ('relativePath' in item) {
      emit('openDirectory', item.relativePath)
    } else {
      const newPath = props.breadcrumb.length > 0
        ? `${props.breadcrumb.join('/')}/${item.name}`
        : item.name
      emit('openDirectory', newPath)
    }
  }
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN')
}

// Context menu
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuFile = ref<string | null>(null)
const contextMenuIsBlank = ref(false)

function onContextMenu(event: MouseEvent, fileName?: string) {
  event.preventDefault()
  contextMenuVisible.value = true
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuFile.value = fileName || null
  contextMenuIsBlank.value = !fileName
}

function closeFileContextMenu() {
  contextMenuVisible.value = false
  contextMenuFile.value = null
  contextMenuIsBlank.value = false
}

// Inline rename
const renamingFile = ref<string | null>(null)

watchEffect(() => {
  if (
    props.autoRenameItem &&
    props.files.some((f) => f.name === props.autoRenameItem) &&
    renamingFile.value !== props.autoRenameItem
  ) {
    renamingFile.value = props.autoRenameItem
    emit('autoRenameConsumed')
  }
})

function onRenameClick() {
  if (contextMenuFile.value) {
    renamingFile.value = contextMenuFile.value
  }
  closeFileContextMenu()
}

function onRenameSave(oldName: string, newName: string) {
  renamingFile.value = null
  if (newName && newName !== oldName) {
    emit('renameFile', oldName, newName)
  }
}

function onRenameCancel() {
  renamingFile.value = null
}

async function onDeleteClick() {
  if (contextMenuFile.value) {
    if (await confirmDialog(`确认永久删除文件「${contextMenuFile.value}」？此操作不可撤销。`, { title: '提示', kind: 'danger' })) {
      emit('deleteFile', contextMenuFile.value)
    }
  }
  closeFileContextMenu()
}

function onMoveClick() {
  if (contextMenuFile.value) {
    emit('moveFile', contextMenuFile.value)
  }
  closeFileContextMenu()
}

function onCopyClick() {
  if (contextMenuFile.value) {
    emit('copyFile', contextMenuFile.value)
  }
  closeFileContextMenu()
}

function onCreateFolderClick() {
  closeFileContextMenu()
  emit('createFolder')
}
</script>

<template>
  <div data-testid="file-explorer" class="flex h-full flex-col bg-surface-1" @contextmenu="onContextMenu($event)">
    <!-- Toolbar -->
    <div class="flex items-center gap-3 border-b border-border-default px-4 py-3">
      <div class="flex gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          class="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-2 hover:text-text-primary"
          @click="emit('goBack')"
        >
          <ChevronLeftIcon class="size-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          class="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-2 hover:text-text-primary"
          @click="emit('goForward')"
        >
          <ChevronRightIcon class="size-5" />
        </Button>
      </div>

      <div class="flex flex-1 items-center gap-1 overflow-hidden">
        <Button
          variant="ghost"
          size="sm"
          class="shrink-0 text-sm text-text-secondary hover:text-text-primary"
          @click="emit('navigateToBreadcrumb', -1)"
        >
          根目录
        </Button>
        <template v-for="(segment, idx) in breadcrumb" :key="idx">
          <ChevronRightIcon class="size-3 shrink-0 text-text-tertiary" />
          <Button
            variant="ghost"
            size="sm"
            class="truncate text-sm text-text-secondary hover:text-text-primary"
            @click="emit('navigateToBreadcrumb', idx)"
          >
            {{ segment }}
          </Button>
        </template>
      </div>

      <div class="relative">
        <SearchIcon class="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
        <Input
          :value="searchQuery"
          type="text"
          placeholder="搜索文件..."
          class="h-8 w-48 rounded-md border-border-default bg-white pl-9 pr-3 text-sm text-text-primary placeholder-text-tertiary"
          @keyup.enter="emit('search', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <Button
        class="flex items-center gap-1.5 rounded-md bg-accent-500 px-3 py-1.5 text-sm text-white hover:bg-accent-600"
        @click="emit('importFiles')"
      >
        <PlusIcon data-icon="inline-start" class="size-4" />
        添加文件
      </Button>
    </div>

    <!-- File list -->
    <div class="flex-1 overflow-auto p-2">
      <div v-if="isLoading" class="flex h-full items-center justify-center">
        <LoaderIcon class="size-8 animate-spin text-accent-500" />
      </div>

      <div v-else-if="displayItems.length === 0" class="flex h-full flex-col items-center justify-center gap-2 text-text-tertiary">
        <FolderOpenIcon class="size-10" />
        <span class="text-sm">暂无文件</span>
        <span class="text-xs">点击上方工具栏的"添加文件"导入文档</span>
      </div>

      <div v-else class="grid grid-cols-[1fr_auto_auto] gap-1">
        <div class="col-span-3 grid grid-cols-subgrid px-3 py-2 text-xs font-medium text-text-tertiary">
          <span>名称</span>
          <span class="text-right">大小</span>
          <span class="text-right">修改时间</span>
        </div>

        <div
          v-for="item in displayItems"
          :key="item.name + ('relativePath' in item ? item.relativePath : '')"
          class="col-span-3 grid cursor-pointer grid-cols-subgrid items-center rounded-md px-3 py-2 transition-colors hover:bg-white"
          @click="onItemClick(item)"
          @contextmenu.stop="onContextMenu($event, item.name)"
        >
          <div class="flex items-center gap-2 overflow-hidden">
            <span class="shrink-0 text-lg">
              <FolderIcon v-if="item.type === 'directory'" class="size-5 text-amber-400" />
              <FileTextIcon v-else class="size-5 text-text-secondary" />
            </span>
            <div class="min-w-0">
              <InlineRename
                v-if="renamingFile === item.name"
                :name="item.name"
                :editing="true"
                @save="(newName) => onRenameSave(item.name, newName)"
                @cancel="onRenameCancel"
              />
              <div v-else class="truncate text-sm text-text-primary">{{ item.name }}</div>
              <div v-if="'relativePath' in item && item.relativePath !== item.name" class="truncate text-xs text-text-tertiary">
                {{ item.relativePath }}
              </div>
            </div>
          </div>
          <span class="text-right text-xs text-text-tertiary">{{ formatSize(item.size) }}</span>
          <span class="text-right text-xs text-text-tertiary">{{ formatDate(item.updatedAt) }}</span>
        </div>
      </div>
    </div>

    <!-- Context Menu -->
    <ContextMenu :visible="contextMenuVisible" :x="contextMenuX" :y="contextMenuY" @close="closeFileContextMenu">
      <div v-if="contextMenuIsBlank" class="py-1">
        <Button
          variant="ghost"
          size="sm"
          class="flex w-full items-center justify-start gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary"
          @click="onCreateFolderClick"
        >
          <FolderPlusIcon class="size-4" />
          <span>新建文件夹</span>
        </Button>
      </div>
      <div v-else class="py-1">
        <Button
          variant="ghost"
          size="sm"
          class="flex w-full items-center justify-start gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary"
          @click="onRenameClick"
        >
          <PencilIcon class="size-4" />
          <span>重命名</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="flex w-full items-center justify-start gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary"
          @click="onMoveClick"
        >
          <FolderInputIcon class="size-4" />
          <span>移动到...</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="flex w-full items-center justify-start gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary"
          @click="onCopyClick"
        >
          <CopyIcon class="size-4" />
          <span>复制到...</span>
        </Button>
        <div class="my-1 border-t border-border-default" />
        <Button
          variant="ghost"
          size="sm"
          class="flex w-full items-center justify-start gap-2 px-3 py-2 text-sm text-danger-500 hover:bg-danger-soft"
          @click="onDeleteClick"
        >
          <Trash2Icon class="size-4" />
          <span>永久删除</span>
        </Button>
      </div>
    </ContextMenu>
  </div>
</template>
