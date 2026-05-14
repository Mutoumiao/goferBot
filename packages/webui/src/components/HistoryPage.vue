<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useSessionStore } from '@/stores/session'
import { confirmDialog } from '@/utils/confirm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ClockIcon,
  ChevronDownIcon,
  LoaderIcon,
  AlertCircleIcon,
  HistoryIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-vue-next'

/** 设计稿「Session history long list」单屏条数（画板示例为 6 条 + 分页） */
const PAGE_SIZE = 6

const store = useSessionStore()

const editingId = ref<string | null>(null)
const editValue = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)
const isSubmittingRename = ref(false)

const currentPage = ref(1)
const openMenuId = ref<string | null>(null)

const totalPages = computed(() =>
  Math.max(1, Math.ceil(store.historySessions.length / PAGE_SIZE)),
)

const displaySessions = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return store.historySessions.slice(start, start + PAGE_SIZE)
})

watch(
  () => store.historySessions.length,
  () => {
    if (currentPage.value > totalPages.value) {
      currentPage.value = totalPages.value
    }
  },
)

watch(currentPage, () => {
  openMenuId.value = null
})

const paginationSegments = computed((): Array<{ kind: 'page'; n: number } | { kind: 'ellipsis' }> => {
  const t = totalPages.value
  const c = currentPage.value
  if (t <= 5) {
    return Array.from({ length: t }, (_, i) => ({ kind: 'page' as const, n: i + 1 }))
  }
  const nums = new Set<number>([1, t, c, c - 1, c + 1].filter((n) => n >= 1 && n <= t))
  const sorted = [...nums].sort((a, b) => a - b)
  const out: Array<{ kind: 'page'; n: number } | { kind: 'ellipsis' }> = []
  let prev = 0
  for (const n of sorted) {
    if (prev && n - prev > 1) out.push({ kind: 'ellipsis' })
    out.push({ kind: 'page', n })
    prev = n
  }
  return out
})

onMounted(() => {
  store.loadHistory()
  document.addEventListener('click', closeMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenu)
})

function closeMenu() {
  openMenuId.value = null
}

function toggleMenu(id: string, e: Event) {
  e.stopPropagation()
  openMenuId.value = openMenuId.value === id ? null : id
}

/** 设计稿 meta 时间：「今天 14:32」「昨天 …」「5月10日」 */
function formatSessionTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const day = 86400000
  const diff = startOf(now) - startOf(d)
  const hm = d.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (diff === 0) return `今天 ${hm}`
  if (diff === day) return `昨天 ${hm}`
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

function metaCountLine(session: { message_count: number }) {
  const n = session.message_count ?? 0
  return `${n} 条消息`
}

function startRename(id: string, title: string) {
  openMenuId.value = null
  editingId.value = id
  editValue.value = title
  isSubmittingRename.value = false
  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

function confirmRename(id: string) {
  if (isSubmittingRename.value) return
  isSubmittingRename.value = true
  if (editValue.value.trim()) {
    store.renameSession(id, editValue.value)
  }
  editingId.value = null
  isSubmittingRename.value = false
}

function cancelRename() {
  editingId.value = null
}

async function handleDelete(sessionId: string) {
  openMenuId.value = null
  if (await confirmDialog('确定删除该会话？', { title: '提示', kind: 'warning' })) {
    store.deleteSession(sessionId)
  }
}

function goPrevPage() {
  currentPage.value = Math.max(1, currentPage.value - 1)
}

function goNextPage() {
  currentPage.value = Math.min(totalPages.value, currentPage.value + 1)
}

function goPage(n: number) {
  currentPage.value = n
}

function onRowClick(sessionId: string) {
  openMenuId.value = null
  store.restoreSession(sessionId)
}

function onResumeClick(e: Event, sessionId: string) {
  e.stopPropagation()
  store.restoreSession(sessionId)
}
</script>

<template>
  <!-- 设计稿「History content unified shell」：padding [56,34]、列宽 880、区块间距 18 -->
  <div class="h-full overflow-y-auto bg-surface-1 px-[34px] py-14">
    <div class="mx-auto w-full max-w-[880px]">
      <!-- Session history header -->
      <div class="mb-[18px] flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0 space-y-1.5">
          <h1 class="text-[28px] font-medium leading-[1.18] tracking-tight text-text-primary">
            会话历史
          </h1>
          <p class="max-w-xl text-sm leading-[1.45] text-text-secondary">
            点击任意记录即可恢复到对应会话，继续追问、整理或查看引用来源。
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="h-[34px] shrink-0 gap-2 rounded-[14px] border-border-default bg-white/[0.6] px-3 py-2 text-[13px] text-text-secondary hover:bg-white/80"
        >
          <ClockIcon data-icon="inline-start" class="size-[15px] text-text-tertiary" />
          <span>全部会话</span>
          <ChevronDownIcon data-icon="inline-end" class="size-4 text-text-tertiary" />
        </Button>
      </div>

      <!-- Loading -->
      <div
        v-if="store.historyLoading"
        class="flex flex-col items-center justify-center gap-3 py-24 text-text-secondary"
      >
        <LoaderIcon class="size-8 animate-spin text-text-tertiary" />
        <p class="text-sm">加载中...</p>
      </div>

      <!-- Error -->
      <div
        v-else-if="store.historyError"
        class="flex flex-col items-center justify-center gap-3 py-24"
      >
        <AlertCircleIcon class="size-8 text-danger-500" />
        <p class="text-sm text-text-secondary">{{ store.historyError }}</p>
        <Button
          type="button"
          class="rounded-2xl bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
          @click="store.loadHistory()"
        >
          重试
        </Button>
      </div>

      <!-- Empty -->
      <div
        v-else-if="store.historySessions.length === 0"
        class="flex flex-col items-center justify-center gap-2 py-24 text-text-tertiary"
      >
        <HistoryIcon class="size-10 opacity-80" />
        <p class="text-sm text-text-secondary">暂无对话历史</p>
        <p class="text-xs text-text-tertiary">开始一段新对话，历史将出现在这里</p>
      </div>

      <template v-else>
        <!-- Session history long list：gap 10（设计稿 lsfWl） -->
        <div data-testid="history-list" class="flex flex-col gap-2.5">
          <div
            v-for="(session, index) in displaySessions"
            :key="session.id"
            data-testid="history-item"
            :class="[
              'group relative flex h-[76px] shrink-0 cursor-pointer items-center gap-3.5 rounded-[18px] border border-border-default px-4 py-3.5 transition-[box-shadow,background-color,border-color]',
              (currentPage - 1) * PAGE_SIZE + index === 0
                ? 'bg-white shadow-[0_1px_4px_rgba(0,0,0,0.03)]'
                : 'bg-white/[0.72] hover:bg-white/[0.88]',
            ]"
            @click="onRowClick(session.id)"
          >
            <!-- 图标区：42×42、圆角 16、#EEF2FF（设计稿 icon1） -->
            <div
              class="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-2xl bg-accent-soft"
            >
              <MessageSquareIcon class="size-[19px] text-accent-500" />
            </div>

            <!-- 主文案：标题 15px/500 + 摘要 12px/#5E6673、垂直 gap 5 -->
            <div class="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-[5px]">
              <div class="min-w-0">
                <Input
                  v-if="editingId === session.id"
                  ref="editInputRef"
                  v-model="editValue"
                  data-testid="history-rename-input"
                  class="h-8 w-full max-w-full rounded-lg border-accent-500 bg-surface-1 px-2 text-[15px] font-medium text-text-primary"
                  @keyup.enter="confirmRename(session.id)"
                  @keyup.esc="cancelRename"
                  @blur="confirmRename(session.id)"
                  @click.stop
                />
                <h3
                  v-else
                  class="truncate text-[15px] font-medium leading-tight text-text-primary"
                >
                  {{ session.title }}
                </h3>
              </div>
              <p
                class="line-clamp-2 text-xs font-normal leading-[1.35] text-text-secondary"
              >
                {{ session.summary || '暂无摘要' }}
              </p>
            </div>

            <!-- 元信息列：固定约 170px、右对齐、两行 #9AA3AF（设计稿 meta1） -->
            <div
              class="hidden w-[170px] shrink-0 flex-col items-end justify-center gap-[5px] text-xs text-text-tertiary sm:flex"
            >
              <span class="whitespace-nowrap">{{ formatSessionTime(session.updated_at) }}</span>
              <span class="whitespace-nowrap text-right">{{ metaCountLine(session) }}</span>
            </div>

            <!-- 操作：恢复（始终可见）+ 更多菜单（设计稿 resume 34×34） -->
            <div class="flex shrink-0 items-center gap-1.5" @click.stop>
              <div class="relative">
                <Button
                  type="button"
                  data-testid="history-menu-btn"
                  title="更多"
                  variant="ghost"
                  size="icon-sm"
                  class="h-[34px] w-[34px] rounded-[14px] text-text-tertiary hover:bg-surface-2 hover:text-text-secondary max-sm:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  :class="openMenuId === session.id ? 'bg-surface-2 opacity-100' : ''"
                  @click="toggleMenu(session.id, $event)"
                >
                  <MoreHorizontalIcon class="size-5" />
                </Button>
                <div
                  v-if="openMenuId === session.id"
                  class="absolute right-0 top-[calc(100%+4px)] z-20 min-w-[120px] rounded-xl border border-border-default bg-white py-1 shadow-lg"
                  @click.stop
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="history-rename-btn"
                    class="flex w-full items-center justify-start gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                    @click="startRename(session.id, session.title)"
                  >
                    <PencilIcon class="size-4" />
                    重命名
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="history-delete-btn"
                    class="flex w-full items-center justify-start gap-2 px-3 py-2 text-sm text-danger-500 hover:bg-danger-soft"
                    @click="handleDelete(session.id)"
                  >
                    <TrashIcon class="size-4" />
                    删除
                  </Button>
                </div>
              </div>

              <Button
                type="button"
                title="恢复会话"
                variant="ghost"
                size="icon-sm"
                class="h-[34px] w-[34px] rounded-[14px] bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                @click="onResumeClick($event, session.id)"
              >
                <ArrowRightIcon class="size-[15px]" />
              </Button>
            </div>
          </div>
        </div>

        <!-- Session history pagination（设计稿 N5rfr3 / R7SVE） -->
        <div
          v-if="totalPages > 1"
          class="mt-[18px] flex h-[42px] w-full max-w-[880px] items-center justify-center"
        >
          <div
            class="inline-flex items-center gap-1 rounded-full border border-border-default bg-white p-1 shadow-[0_1px_6px_rgba(31,35,40,0.04)]"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-text-secondary hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="currentPage <= 1"
              @click="goPrevPage"
            >
              <ChevronLeftIcon data-icon="inline-start" class="size-4 text-text-tertiary" />
              上一页
            </Button>

            <template v-for="(item, idx) in paginationSegments" :key="`p-${idx}-${item.kind === 'page' ? item.n : 'e'}`">
              <span
                v-if="item.kind === 'ellipsis'"
                class="flex h-7 w-6 items-center justify-center text-xs font-medium text-text-tertiary"
              >...</span>
              <Button
                v-else
                type="button"
                variant="ghost"
                size="sm"
                class="flex h-7 w-[30px] items-center justify-center rounded-full text-xs font-medium"
                :class="
                  item.n === currentPage
                    ? 'border border-[#dde5ff] bg-accent-soft text-accent-500'
                    : 'text-text-secondary hover:bg-surface-2'
                "
                @click="goPage(item.n)"
              >
                {{ item.n }}
              </Button>
            </template>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-text-secondary hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="currentPage >= totalPages"
              @click="goNextPage"
            >
              下一页
              <ChevronRightIcon data-icon="inline-end" class="size-4 text-text-tertiary" />
            </Button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
