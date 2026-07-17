import type { KbEntry } from '@goferbot/data'
import { useRequest } from 'alova/client'
import { RefreshCw, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { deleteKb, getKbList } from '@/api/KnowledgeBase'
import { SettingsSurface } from '@/components/layout/SettingsSurface'
import { Button } from '@/components/ui/button'
import { useKeepAliveSilentRefresh } from '@/lib/route-keepalive'
import { cn } from '@/utils/cn'

interface TrashItem {
  id: string
  title: string
  description: string | null
  type: 'kb' | 'session'
  deletedAt: string
}

function mapDeletedEntries(res: unknown): TrashItem[] {
  const entries = (res as { entries?: KbEntry[] })?.entries ?? []
  return entries
    .filter((e) => (e as Record<string, unknown>).isDeleted === true)
    .map((e) => ({
      id: e.id,
      title: e.name,
      description: e.description ?? null,
      type: 'kb' as const,
      deletedAt: ((e as Record<string, unknown>).deletedAt as string) ?? new Date().toISOString(),
    }))
}

export function RecycleBinPage() {
  const [trashItems, setTrashItems] = useState<TrashItem[]>([])
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  const { loading, error, send: reload } = useRequest(() => getKbList(), { immediate: false })
  const { send: removePermanently } = useRequest((id: string) => deleteKb(id), { immediate: false })

  const reloadRef = useRef(reload)
  reloadRef.current = reload

  function fetchTrash() {
    return reloadRef
      .current()
      .then((res) => {
        setTrashItems(mapDeletedEntries(res))
      })
      .catch(() => {
        // error handled by useRequest
      })
      .finally(() => {
        setHasLoadedOnce(true)
      })
  }

  // 首次进入可整页 loading；二次切回无感覆盖（initialLoading 依赖 hasLoadedOnce）
  useKeepAliveSilentRefresh(() => {
    void fetchTrash()
  })

  const handlePermanentDelete = async (id: string) => {
    setRemovingId(id)
    try {
      await removePermanently(id)
      setTrashItems((prev) => prev.filter((item) => item.id !== id))
    } finally {
      setRemovingId(null)
    }
  }

  const initialLoading = loading && !hasLoadedOnce
  const refreshing = loading && hasLoadedOnce

  return (
    <SettingsSurface testId="recycle-page">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-text-tertiary">
            Storage
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">回收站</h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            已删除的知识库与会话 · 保留 30 天后自动清理
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void fetchTrash()}
          disabled={loading}
          className="h-9 gap-1.5 rounded-lg border-border-default bg-surface-1 shadow-sm"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          {refreshing ? '刷新中' : '刷新'}
        </Button>
      </header>

      {initialLoading && (
        <div className="rounded-2xl border border-border-panel bg-surface-1 px-6 py-16 text-center shadow-sm">
          <p className="text-sm text-text-secondary">加载中…</p>
        </div>
      )}

      {!initialLoading && error && trashItems.length === 0 && (
        <div className="rounded-2xl border border-error/20 bg-surface-1 px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-error">加载失败：{error.message || '未知错误'}</p>
          <Button
            type="button"
            variant="link"
            className="mt-3 text-brand-blue"
            onClick={() => void fetchTrash()}
          >
            重试
          </Button>
        </div>
      )}

      {!initialLoading && !error && trashItems.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border-default bg-surface-1 px-6 py-16 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-3 text-text-tertiary">
            <Trash2 className="h-6 w-6" />
          </div>
          <p className="mt-4 text-sm font-medium text-text-primary">回收站为空</p>
          <p className="mt-1.5 text-xs text-text-tertiary">
            删除的知识库会显示在这里，可在 30 天内处理
          </p>
        </div>
      )}

      {!initialLoading && trashItems.length > 0 && (
        <ul className={cn('space-y-2.5', refreshing && 'opacity-70 transition-opacity')}>
          {trashItems.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-border-panel bg-surface-1 px-4 py-3.5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] font-medium text-text-secondary">
                    {item.type === 'kb' ? '知识库' : '会话'}
                  </span>
                  <p className="truncate text-sm font-medium text-text-primary">
                    {item.title || '未命名'}
                  </p>
                </div>
                {item.description && (
                  <p className="mt-1 truncate text-xs text-text-tertiary">{item.description}</p>
                )}
                <p className="mt-1 text-xs text-text-tertiary">
                  删除于 {new Date(item.deletedAt).toLocaleDateString('zh-CN')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled
                  className="rounded-lg p-2 text-text-tertiary opacity-40"
                  title="恢复功能需要后端支持"
                >
                  <RestoreIcon />
                </button>
                <button
                  type="button"
                  onClick={() => void handlePermanentDelete(item.id)}
                  disabled={removingId === item.id}
                  className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-error/10 hover:text-error disabled:opacity-50"
                  title="彻底删除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SettingsSurface>
  )
}

function RestoreIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  )
}
