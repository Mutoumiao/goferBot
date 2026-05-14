<script setup lang="ts">
import { onMounted } from 'vue'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'
import { confirmDialog } from '@/utils/confirm'
import { Button } from '@/components/ui/button'
import {
  TrashIcon,
  Trash2Icon,
  LoaderIcon,
  RotateCcwIcon,
  InfoIcon,
  DatabaseIcon,
} from 'lucide-vue-next'

const store = useKnowledgeBaseStore()

onMounted(() => {
  store.loadDeletedKnowledgeBases()
})

async function onRestore(id: string) {
  const kb = store.deletedKnowledgeBases.find((k) => k.id === id)
  if (kb && (await confirmDialog(`确认恢复知识库「${kb.name}」？`, { title: '提示', kind: 'info' }))) {
    store.restoreKnowledgeBase(id)
  }
}

async function onPermanentDelete(id: string) {
  const kb = store.deletedKnowledgeBases.find((k) => k.id === id)
  if (kb && (await confirmDialog(`确认彻底删除知识库「${kb.name}」？此操作不可撤销。`, { title: '提示', kind: 'danger' }))) {
    store.permanentlyDeleteKnowledgeBase(id)
  }
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN')
}
</script>

<template>
  <div class="h-full overflow-y-auto bg-surface-1 px-6 py-14">
    <div class="mx-auto max-w-[820px] space-y-6">
      <!-- 设计稿「Trash page header」 -->
      <div class="flex flex-wrap items-start justify-between gap-4 px-1.5">
        <div class="min-w-0 space-y-2">
          <h1 class="text-[28px] font-medium leading-[1.18] tracking-tight text-text-primary">
            回收站
          </h1>
          <p class="text-sm leading-relaxed text-text-secondary">
            删除的对话和知识文件会暂时保留，过期后自动清理。
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2 rounded-[14px] bg-danger-soft px-3 py-2">
          <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-danger-500" />
          <span class="text-xs font-normal text-danger-500">自动清理开启</span>
        </div>
      </div>

      <!-- 设计稿「Trash quiet panel」：圆角 28、内边距 22、阴影 -->
      <div class="rounded-[28px] border border-border-default bg-white p-[22px] shadow-[0_16px_34px_rgba(0,0,0,0.06)]">
        <!-- Summary -->
        <div class="mb-[18px] flex flex-wrap items-center gap-4">
          <div class="flex h-[46px] w-[46px] items-center justify-center rounded-[18px] bg-surface-2">
            <TrashIcon class="size-5 text-text-secondary" />
          </div>
          <div class="flex-1">
            <div class="text-lg font-medium text-text-primary">{{ store.deletedKnowledgeBases.length }} 个项目等待处理</div>
            <div class="text-sm text-text-tertiary">最早的项目将在 30 天后永久删除。</div>
          </div>
          <Button
            v-if="store.deletedKnowledgeBases.length > 0"
            variant="outline"
            class="flex items-center gap-2 rounded-[15px] border-danger-500/20 bg-white px-3 py-2 text-sm text-danger-500 hover:bg-danger-soft"
            @click="store.deletedKnowledgeBases.forEach((kb) => onPermanentDelete(kb.id))"
          >
            <Trash2Icon data-icon="inline-start" class="size-4" />
            清空
          </Button>
        </div>

        <!-- Loading -->
        <div v-if="store.isLoading" class="flex items-center justify-center py-12">
          <LoaderIcon class="size-8 animate-spin text-accent-500" />
        </div>

        <!-- Empty -->
        <div v-else-if="store.deletedKnowledgeBases.length === 0" class="flex flex-col items-center justify-center py-12 text-text-tertiary">
          <Trash2Icon class="size-10" />
          <span class="mt-3 text-sm">回收站为空</span>
        </div>

        <!-- List -->
        <div v-else class="space-y-2.5">
          <div
            v-for="kb in store.deletedKnowledgeBases"
            :key="kb.id"
            class="flex min-h-[76px] items-center gap-3.5 rounded-[20px] border border-border-default bg-[#fafbfc] p-4 transition-colors hover:bg-surface-1"
          >
            <div class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[14px] bg-surface-2">
              <DatabaseIcon class="size-4 text-text-secondary" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-[15px] font-medium text-text-primary">{{ kb.name }}</div>
              <div class="text-xs text-text-tertiary">删除于 {{ formatDate(kb.deleted_at!) }}</div>
            </div>
            <Button
              variant="outline"
              class="flex items-center gap-2 rounded-[14px] border-border-default bg-white px-3 py-2 text-sm text-text-secondary hover:border-accent-500/30 hover:text-accent-500"
              @click="onRestore(kb.id)"
            >
              <RotateCcwIcon data-icon="inline-start" class="size-4" />
              恢复
            </Button>
            <Button
              variant="outline"
              class="flex items-center gap-2 rounded-[14px] border-danger-500/20 bg-white px-3 py-2 text-sm text-danger-500 hover:bg-danger-soft"
              @click="onPermanentDelete(kb.id)"
            >
              <Trash2Icon data-icon="inline-start" class="size-4" />
              彻底删除
            </Button>
          </div>
        </div>
      </div>

      <!-- 设计稿「Trash quiet note」 -->
      <div
        class="flex items-start gap-2.5 rounded-[20px] border border-border-default bg-white/50 px-4 py-3.5"
      >
        <InfoIcon class="size-4 shrink-0 text-text-tertiary" />
        <p class="text-[13px] leading-snug text-text-tertiary">永久删除前，恢复会保留原对话上下文、引用来源和知识库归属。</p>
      </div>
    </div>
  </div>
</template>
