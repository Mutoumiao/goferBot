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
  <div class="h-full overflow-y-auto px-14 py-12">
    <div class="mx-auto max-w-[820px]">
      <!-- Header -->
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-[28px] font-medium text-text-primary">回收站</h1>
          <p class="mt-1.5 text-sm text-text-secondary">删除的对话和知识文件会暂时保留，过期后自动清理。</p>
        </div>
        <div class="flex items-center gap-2 rounded-[14px] bg-danger-soft px-3 py-2">
          <span class="h-1.5 w-1.5 rounded-full bg-danger-500" />
          <span class="text-xs text-danger-500">自动清理开启</span>
        </div>
      </div>

      <!-- Main Panel -->
      <div class="rounded-[28px] border border-border-default bg-white p-6 shadow-lg">
        <!-- Summary -->
        <div class="mb-5 flex items-center gap-4">
          <div class="flex h-[46px] w-[46px] items-center justify-center rounded-[18px] bg-surface-2">
            <span class="i-mdi-delete text-xl text-text-secondary" />
          </div>
          <div class="flex-1">
            <div class="text-lg font-medium text-text-primary">{{ store.deletedKnowledgeBases.length }} 个项目等待处理</div>
            <div class="text-sm text-text-tertiary">最早的项目将在 30 天后永久删除。</div>
          </div>
          <button
            v-if="store.deletedKnowledgeBases.length > 0"
            class="flex items-center gap-2 rounded-[15px] border border-danger-500/20 bg-white px-3 py-2 text-sm text-danger-500 transition-colors hover:bg-danger-soft"
            @click="store.deletedKnowledgeBases.forEach((kb) => onPermanentDelete(kb.id))"
          >
            <span class="i-mdi-delete-forever text-sm" />
            清空
          </button>
        </div>

        <!-- Loading -->
        <div v-if="store.isLoading" class="flex items-center justify-center py-12">
          <span class="i-mdi-loading animate-spin text-2xl text-accent-500" />
        </div>

        <!-- Empty -->
        <div v-else-if="store.deletedKnowledgeBases.length === 0" class="flex flex-col items-center justify-center py-12 text-text-tertiary">
          <span class="i-mdi-delete-empty text-4xl" />
          <span class="mt-3 text-sm">回收站为空</span>
        </div>

        <!-- List -->
        <div v-else class="space-y-2.5">
          <div
            v-for="kb in store.deletedKnowledgeBases"
            :key="kb.id"
            class="flex items-center gap-3.5 rounded-[20px] border border-border-default bg-surface-1/60 p-4 transition-all hover:bg-surface-1"
          >
            <div class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[14px] bg-surface-2">
              <span :class="`i-${kb.icon || 'mdi-database'} text-base text-text-secondary`" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-[15px] font-medium text-text-primary">{{ kb.name }}</div>
              <div class="text-xs text-text-tertiary">删除于 {{ formatDate(kb.deleted_at!) }}</div>
            </div>
            <button
              class="flex items-center gap-2 rounded-[14px] border border-border-default bg-white px-3 py-2 text-sm text-text-secondary transition-all hover:border-accent-500/30 hover:text-accent-500"
              @click="onRestore(kb.id)"
            >
              <span class="i-mdi-restore text-sm" />
              恢复
            </button>
            <button
              class="flex items-center gap-2 rounded-[14px] border border-danger-500/20 bg-white px-3 py-2 text-sm text-danger-500 transition-all hover:bg-danger-soft"
              @click="onPermanentDelete(kb.id)"
            >
              <span class="i-mdi-delete-forever text-sm" />
              彻底删除
            </button>
          </div>
        </div>
      </div>

      <!-- Note -->
      <div class="mt-6 flex items-center gap-3 rounded-[20px] border border-border-default bg-white/50 px-4 py-3.5">
        <span class="i-mdi-information-outline text-base text-text-tertiary" />
        <p class="text-sm text-text-tertiary">永久删除前，恢复会保留原对话上下文、引用来源和知识库归属。</p>
      </div>
    </div>
  </div>
</template>
