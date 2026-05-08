<script setup lang="ts">
import { onMounted } from 'vue'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'
import { confirmDialog } from '@/utils/confirm'

const store = useKnowledgeBaseStore()

onMounted(() => {
  store.loadDeletedKnowledgeBases()
})

async function onRestore(id: string) {
  const kb = store.deletedKnowledgeBases.find((k) => k.id === id)
  if (kb && (await confirmDialog(`确认恢复知识库「${kb.name}」？`))) {
    store.restoreKnowledgeBase(id)
  }
}

async function onPermanentDelete(id: string) {
  const kb = store.deletedKnowledgeBases.find((k) => k.id === id)
  if (kb && (await confirmDialog(`确认彻底删除知识库「${kb.name}」？此操作不可撤销。`))) {
    store.permanentlyDeleteKnowledgeBase(id)
  }
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN')
}
</script>

<template>
  <div class="flex h-full flex-col bg-surface-0">
    <div class="border-b border-surface-3 px-5 py-3">
      <h2 class="text-base font-medium text-text-primary">回收站</h2>
      <p class="text-xs text-text-tertiary">已删除的知识库可以恢复</p>
    </div>

    <div class="flex-1 overflow-auto p-4">
      <div v-if="store.isLoading" class="flex h-full items-center justify-center">
        <span class="i-mdi-loading animate-spin text-2xl text-accent-500" />
      </div>

      <div v-else-if="store.deletedKnowledgeBases.length === 0" class="flex h-full flex-col items-center justify-center gap-2 text-text-tertiary">
        <span class="i-mdi-delete-empty text-4xl" />
        <span class="text-sm">回收站为空</span>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="kb in store.deletedKnowledgeBases"
          :key="kb.id"
          class="flex items-center justify-between rounded-lg border border-surface-3 bg-surface-1 px-4 py-3"
        >
          <div class="flex items-center gap-3">
            <span :class="`i-${kb.icon || 'mdi-database'} text-xl text-text-secondary`" />
            <div>
              <div class="text-sm font-medium text-text-primary">{{ kb.name }}</div>
              <div class="text-xs text-text-tertiary">删除于 {{ formatDate(kb.deleted_at!) }}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="rounded-md px-3 py-1.5 text-sm text-accent-400 transition-colors hover:bg-accent-500/10"
              @click="onRestore(kb.id)"
            >
              恢复
            </button>
            <button
              class="rounded-md px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/10"
              @click="onPermanentDelete(kb.id)"
            >
              彻底删除
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
