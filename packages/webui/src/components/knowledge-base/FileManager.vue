<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useFileStore, type DocumentItem, type Folder } from '@/stores/file'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { openDialog } from '@/overlays'
import CreateFolderDialog from '@/overlays/dialogs/CreateFolderDialog.vue'
import RenameDialog from '@/overlays/dialogs/RenameDialog.vue'
import DeleteConfirmDialog from '@/overlays/dialogs/DeleteConfirmDialog.vue'
import {
  SearchIcon,
  ArrowUpDownIcon,
  LoaderIcon,
  AlertCircleIcon,
  PlusIcon,
  FolderIcon,
  UploadIcon,
  FolderPlusIcon,
  PencilIcon,
  TrashIcon,
  XIcon,
} from 'lucide-vue-next'
import BreadcrumbNav from './BreadcrumbNav.vue'
import FileGridItem from './FileGridItem.vue'
import FileUpload from './FileUpload.vue'

const props = defineProps<{
  kbId: string | null
}>()

const fileStore = useFileStore()
const searchQuery = ref('')
const sortBy = ref<'name' | 'date' | 'type'>('date')
const selectedIds = ref<Set<string>>(new Set())
const fileUploadRef = ref<InstanceType<typeof FileUpload> | null>(null)
const isDragOver = ref(false)

// Context menu
const contextMenuPos = ref({ x: 0, y: 0 })
const showContextMenu = ref(false)
const contextMenuTarget = ref<(DocumentItem | Folder) | null>(null)
const contextMenuIsBackground = ref(false)

watch(
  () => props.kbId,
  (id) => {
    if (id) fileStore.loadItems(id)
    else {
      fileStore.folders = []
      fileStore.documents = []
    }
    selectedIds.value.clear()
  },
  { immediate: true },
)

const filteredItems = computed(() => {
  const items: (DocumentItem | Folder)[] = [
    ...fileStore.folders,
    ...fileStore.documents,
  ]
  let result = items
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter((i) => i.name.toLowerCase().includes(q))
  }
  result.sort((a, b) => {
    if (sortBy.value === 'name') return a.name.localeCompare(b.name)
    if (sortBy.value === 'date')
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    if (sortBy.value === 'type') {
      const aIsFolder = !('status' in a)
      const bIsFolder = !('status' in b)
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1
      return a.name.localeCompare(b.name)
    }
    return 0
  })
  return result
})

function navigateTo(folderId: string | null) {
  if (!props.kbId) return
  fileStore.loadItems(props.kbId, folderId)
  selectedIds.value.clear()
}

function openItem(item: DocumentItem | Folder) {
  if (!('status' in item)) {
    navigateTo(item.id)
  }
}

function toggleSelect(item: DocumentItem | Folder, add: boolean) {
  if (add) {
    if (selectedIds.value.has(item.id)) selectedIds.value.delete(item.id)
    else selectedIds.value.add(item.id)
  } else {
    selectedIds.value.clear()
    selectedIds.value.add(item.id)
  }
}

function handleContextMenu(e: MouseEvent, item: DocumentItem | Folder) {
  e.preventDefault()
  contextMenuTarget.value = item
  contextMenuIsBackground.value = false
  contextMenuPos.value = { x: e.clientX, y: e.clientY }
  showContextMenu.value = true
}

function handleBackgroundContextMenu(e: MouseEvent) {
  e.preventDefault()
  contextMenuTarget.value = null
  contextMenuIsBackground.value = true
  contextMenuPos.value = { x: e.clientX, y: e.clientY }
  showContextMenu.value = true
}

function closeContextMenu() {
  showContextMenu.value = false
  contextMenuTarget.value = null
}

function openCreateFolderDialog() {
  closeContextMenu()
  openDialog(CreateFolderDialog, {
    kbId: props.kbId!,
    parentFolderId: fileStore.currentFolderId,
    onConfirm: async (name) => {
      await fileStore.createFolder(props.kbId!, name, fileStore.currentFolderId)
      if (props.kbId) fileStore.loadItems(props.kbId, fileStore.currentFolderId)
    },
  })
}

function openRenameDialog(item: DocumentItem | Folder) {
  closeContextMenu()
  openDialog(RenameDialog, {
    title: '重命名',
    initialValue: item.name,
    onConfirm: async (newName) => {
      if ('status' in item) {
        await fileStore.renameDocument(item.id, newName)
      } else {
        await fileStore.renameFolder(props.kbId!, item.id, newName)
      }
      if (props.kbId) fileStore.loadItems(props.kbId, fileStore.currentFolderId)
    },
  })
}

function openDeleteDialog(item: DocumentItem | Folder) {
  closeContextMenu()
  const isFolder = !('status' in item)
  openDialog(DeleteConfirmDialog, {
    title: '删除确认',
    message: `确认删除「${item.name}」？${isFolder ? '<span class="text-danger-500">文件夹内的所有内容将被一并删除。</span>' : ''}`,
    kind: 'danger',
    onConfirm: async () => {
      if (isFolder) {
        await fileStore.deleteFolder(props.kbId!, item.id)
      } else {
        await fileStore.deleteDocument(item.id)
      }
      if (props.kbId) fileStore.loadItems(props.kbId, fileStore.currentFolderId)
    },
  })
}

function onUploaded() {
  if (props.kbId) {
    fileStore.loadItems(props.kbId, fileStore.currentFolderId)
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = true
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  fileUploadRef.value?.handleDrop(e)
}
</script>

<template>
  <div
    data-testid="file-explorer"
    class="flex h-full flex-col bg-surface-1"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <!-- Toolbar -->
    <div
      class="flex items-center gap-3 border-b border-border-default px-4 py-3"
    >
      <BreadcrumbNav :path="fileStore.breadcrumb" @navigate="navigateTo" />
      <div class="ml-auto flex items-center gap-2">
        <div class="relative">
          <SearchIcon
            class="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-tertiary"
          />
          <Input
            v-model="searchQuery"
            placeholder="搜索文件..."
            class="h-8 w-48 rounded-lg border-border-default bg-white pl-9 text-sm"
          />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          class="text-text-tertiary"
          @click="sortBy = sortBy === 'name' ? 'date' : 'name'"
        >
          <ArrowUpDownIcon class="size-4" />
        </Button>
        <FileUpload
          ref="fileUploadRef"
          :kb-id="kbId"
          :folder-id="fileStore.currentFolderId"
          @uploaded="onUploaded"
        >
          <Button
            class="gap-1 rounded-lg bg-accent-500 px-3 py-1.5 text-sm text-white hover:bg-accent-600"
            @click="fileUploadRef?.open()"
          >
            <PlusIcon class="size-4" />
            添加文件
          </Button>
        </FileUpload>
        <Button
          variant="ghost"
          size="icon-sm"
          class="text-text-tertiary"
          @click="openCreateFolderDialog"
        >
          <FolderPlusIcon class="size-4" />
        </Button>
      </div>
    </div>

    <!-- Drag overlay -->
    <div
      v-if="isDragOver"
      class="absolute inset-0 z-40 flex items-center justify-center bg-accent-500/10"
    >
      <div class="rounded-2xl border-2 border-dashed border-accent-500 bg-white px-8 py-6 text-center shadow-lg">
        <UploadIcon class="mx-auto size-10 text-accent-500" />
        <p class="mt-2 text-sm font-medium text-text-primary">释放文件以上传</p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="fileStore.isLoading" class="grid grid-cols-4 gap-3 p-4">
      <div
        v-for="i in 8"
        :key="i"
        class="h-28 animate-pulse rounded-xl bg-surface-2"
      />
    </div>

    <!-- Error -->
    <div
      v-else-if="fileStore.error"
      class="flex flex-1 flex-col items-center justify-center gap-3 p-8"
    >
      <AlertCircleIcon class="size-8 text-danger-500" />
      <p class="text-sm text-text-secondary">{{ fileStore.error }}</p>
      <Button
        variant="ghost"
        class="text-accent-500"
        @click="navigateTo(fileStore.currentFolderId)"
      >
        重试
      </Button>
    </div>

    <!-- Empty -->
    <div
      v-else-if="filteredItems.length === 0"
      class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-text-tertiary"
    >
      <FolderIcon class="size-12 opacity-40" />
      <p class="text-sm">
        {{ searchQuery ? '未找到匹配的文件' : '点击添加文件导入文档' }}
      </p>
      <FileUpload
        v-if="!searchQuery"
        ref="fileUploadRef"
        :kb-id="kbId"
        :folder-id="fileStore.currentFolderId"
        @uploaded="onUploaded"
      >
        <Button
          variant="ghost"
          class="text-accent-500"
          @click="fileUploadRef?.open()"
        >
          添加文件
        </Button>
      </FileUpload>
    </div>

    <!-- Grid -->
    <div
      v-else
      class="grid grid-cols-2 gap-3 overflow-auto p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      @contextmenu="handleBackgroundContextMenu"
    >
      <FileGridItem
        v-for="item in filteredItems"
        :key="item.id"
        :item="item"
        :is-selected="selectedIds.has(item.id)"
        @open="openItem(item)"
        @select="toggleSelect(item, $event)"
        @contextmenu="handleContextMenu($event, item)"
      />
    </div>

    <!-- Context Menu -->
    <Teleport to="body">
      <div
        v-if="showContextMenu"
        class="fixed z-50 min-w-[160px] rounded-lg border border-border-default bg-white py-1 shadow-xl"
        :style="{ left: `${contextMenuPos.x}px`, top: `${contextMenuPos.y}px` }"
        @click.stop
      >
        <template v-if="contextMenuIsBackground">
          <button
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
            @click="openCreateFolderDialog"
          >
            <FolderPlusIcon class="size-4" />
            新建文件夹
          </button>
        </template>
        <template v-else-if="contextMenuTarget">
          <button
            v-if="!('status' in contextMenuTarget)"
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
            @click="openItem(contextMenuTarget)"
          >
            <FolderIcon class="size-4" />
            打开
          </button>
          <button
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
            @click="openRenameDialog(contextMenuTarget)"
          >
            <PencilIcon class="size-4" />
            重命名
          </button>
          <div class="my-1 h-px bg-border-default" />
          <button
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger-500 hover:bg-danger-50"
            @click="openDeleteDialog(contextMenuTarget)"
          >
            <TrashIcon class="size-4" />
            删除
          </button>
        </template>
      </div>
      <div v-if="showContextMenu" class="fixed inset-0 z-40" @click="closeContextMenu" />
    </Teleport>
  </div>
</template>
