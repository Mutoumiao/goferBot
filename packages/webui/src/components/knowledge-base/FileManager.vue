<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useFileStore, type DocumentItem, type Folder } from '@/stores/file'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  SearchIcon,
  ArrowUpDownIcon,
  LoaderIcon,
  AlertCircleIcon,
  PlusIcon,
  FolderIcon,
} from 'lucide-vue-next'
import BreadcrumbNav from './BreadcrumbNav.vue'
import FileGridItem from './FileGridItem.vue'

const props = defineProps<{
  kbId: string | null
}>()

const emit = defineEmits<{
  upload: []
}>()

const fileStore = useFileStore()
const searchQuery = ref('')
const sortBy = ref<'name' | 'date' | 'type'>('date')
const selectedIds = ref<Set<string>>(new Set())

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
  // TODO: f-08 实现右键菜单
  console.log('context menu', item, e)
}
</script>

<template>
  <div class="flex h-full flex-col bg-surface-1">
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
        <Button
          class="gap-1 rounded-lg bg-accent-500 px-3 py-1.5 text-sm text-white hover:bg-accent-600"
          @click="emit('upload')"
        >
          <PlusIcon class="size-4" />
          添加文件
        </Button>
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
      <Button
        v-if="!searchQuery"
        variant="ghost"
        class="text-accent-500"
        @click="emit('upload')"
      >
        添加文件
      </Button>
    </div>

    <!-- Grid -->
    <div
      v-else
      class="grid grid-cols-2 gap-3 overflow-auto p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
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
  </div>
</template>
