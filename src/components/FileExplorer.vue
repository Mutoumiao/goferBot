<script setup lang="ts">
import { computed } from 'vue'
import type { FileItem, SearchResultItem } from '@/types'

const props = defineProps<{
  files: FileItem[]
  searchResults: SearchResultItem[]
  searchQuery: string
  breadcrumb: string[]
  isSearchMode: boolean
  isLoading: boolean
}>()

const emit = defineEmits<{
  openDirectory: [path: string]
  navigateToBreadcrumb: [index: number]
  search: [query: string]
  importFiles: []
  goBack: []
  goForward: []
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

function onItemDoubleClick(item: FileItem | SearchResultItem) {
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
</script>

<template>
  <div class="flex h-full flex-col bg-surface-0">
    <!-- Toolbar -->
    <div class="flex items-center gap-3 border-b border-surface-3 px-4 py-3">
      <!-- Navigation buttons -->
      <div class="flex gap-1">
        <button
          class="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
          @click="emit('goBack')"
        >
          <span class="i-mdi-chevron-left text-lg" />
        </button>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
          @click="emit('goForward')"
        >
          <span class="i-mdi-chevron-right text-lg" />
        </button>
      </div>

      <!-- Breadcrumb -->
      <div class="flex flex-1 items-center gap-1 overflow-hidden">
        <button
          class="shrink-0 text-sm text-text-secondary hover:text-text-primary"
          @click="emit('navigateToBreadcrumb', -1)"
        >
          根目录
        </button>
        <template v-for="(segment, idx) in breadcrumb" :key="idx">
          <span class="i-mdi-chevron-right text-xs text-text-tertiary" />
          <button
            class="truncate text-sm text-text-secondary hover:text-text-primary"
            @click="emit('navigateToBreadcrumb', idx)"
          >
            {{ segment }}
          </button>
        </template>
      </div>

      <!-- Search -->
      <div class="relative">
        <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary i-mdi-magnify" />
        <input
          :value="searchQuery"
          type="text"
          placeholder="搜索文件..."
          class="h-8 w-48 rounded-md border border-surface-3 bg-surface-1 pl-9 pr-3 text-sm text-text-primary placeholder-text-tertiary outline-none transition-colors focus:border-accent-500"
          @keyup.enter="emit('search', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <!-- Import button -->
      <button
        class="flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-accent-500"
        @click="emit('importFiles')"
      >
        <span class="i-mdi-plus text-sm" />
        添加文件
      </button>
    </div>

    <!-- File list -->
    <div class="flex-1 overflow-auto p-2">
      <div v-if="isLoading" class="flex h-full items-center justify-center">
        <span class="i-mdi-loading animate-spin text-2xl text-accent-500" />
      </div>

      <div v-else-if="displayItems.length === 0" class="flex h-full flex-col items-center justify-center gap-2 text-text-tertiary">
        <span class="i-mdi-folder-open-outline text-4xl" />
        <span class="text-sm">暂无文件</span>
      </div>

      <div v-else class="grid grid-cols-[1fr_auto_auto] gap-1">
        <!-- Header -->
        <div class="col-span-3 grid grid-cols-subgrid px-3 py-2 text-xs font-medium text-text-tertiary">
          <span>名称</span>
          <span class="text-right">大小</span>
          <span class="text-right">修改时间</span>
        </div>

        <!-- Items -->
        <div
          v-for="item in displayItems"
          :key="item.name + ('relativePath' in item ? item.relativePath : '')"
          class="col-span-3 grid cursor-pointer grid-cols-subgrid items-center rounded-md px-3 py-2 transition-colors hover:bg-surface-2"
          @dblclick="onItemDoubleClick(item)"
        >
          <div class="flex items-center gap-2 overflow-hidden">
            <span
              class="shrink-0 text-lg"
              :class="item.type === 'directory' ? 'i-mdi-folder text-amber-400' : 'i-mdi-file-document-outline text-text-secondary'"
            />
            <div class="min-w-0">
              <div class="truncate text-sm text-text-primary">{{ item.name }}</div>
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
  </div>
</template>