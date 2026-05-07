<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'
import FileExplorer from './FileExplorer.vue'

const store = useKnowledgeBaseStore()
const showNewKbDialog = ref(false)
const newKbName = ref('')
const newKbError = ref('')

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
  const name = newKbName.value.trim()
  if (!name) {
    newKbError.value = '请输入知识库名称'
    return
  }
  try {
    await store.createKnowledgeBase(name)
    showNewKbDialog.value = false
  } catch {
    newKbError.value = store.error || '创建失败'
  }
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
    // 返回浏览根目录
    store.navigateToPath('')
    return
  }
  store.searchFiles(query)
}

function onImportFiles() {
  store.importFiles()
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
        >
          <span class="i-mdi-bookshelf text-lg" />
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
        @open-directory="onOpenDirectory"
        @navigate-to-breadcrumb="onNavigateToBreadcrumb"
        @search="onSearch"
        @import-files="onImportFiles"
        @go-back="store.goBack"
        @go-forward="store.goForward"
      />
      <div v-else class="flex h-full flex-col items-center justify-center gap-3 text-text-tertiary">
        <span class="i-mdi-bookshelf text-5xl" />
        <span class="text-sm">选择一个知识库或创建新库</span>
      </div>
    </div>

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
              <button
                class="rounded-md px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
                @click="showNewKbDialog = false"
              >
                取消
              </button>
              <button
                class="rounded-md bg-accent-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-accent-500"
                @click="confirmCreateKb"
              >
                创建
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
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
