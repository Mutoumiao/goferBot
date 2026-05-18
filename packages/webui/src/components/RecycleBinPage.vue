<script setup lang="ts">
import { computed } from 'vue'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'
import { Button } from '@/components/ui/button'
import {
  TrashIcon,
  Trash2Icon,
  InfoIcon,
} from 'lucide-vue-next'

const store = useKnowledgeBaseStore()

// 回收站功能后端未实现，使用占位数据防止页面崩溃
const deletedItems = computed(() => {
  const items = (store as any).deletedKnowledgeBases as unknown[]
  return Array.isArray(items) ? items : []
})
const hasItems = computed(() => deletedItems.value.length > 0)
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
            <div class="text-lg font-medium text-text-primary">{{ deletedItems.length }} 个项目等待处理</div>
            <div class="text-sm text-text-tertiary">回收站功能即将上线，敬请期待。</div>
          </div>
        </div>

        <!-- Empty -->
        <div class="flex flex-col items-center justify-center py-12 text-text-tertiary">
          <Trash2Icon class="size-10" />
          <span class="mt-3 text-sm">回收站为空</span>
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
