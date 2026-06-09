import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useRequest } from 'alova/client'
import { getKbList, deleteKb } from '@/api/kb'
import type { KbEntry } from '@goferbot/data'

export const Route = createFileRoute('/app/recycle-bin')({
  component: RecycleBinPage,
})

interface TrashItem {
  id: string
  title: string
  description: string | null
  type: 'kb' | 'session'
  deletedAt: string
}

function RecycleBinPage() {
  const [trashItems, setTrashItems] = useState<TrashItem[]>([])
  const [removingId, setRemovingId] = useState<string | null>(null)

  const { loading, error, send: reload } = useRequest(
    () => getKbList(),
    { immediate: false },
  )

  const { send: removePermanently } = useRequest(
    (id: string) => deleteKb(id),
    { immediate: false },
  )

  useEffect(() => {
    reload().then((res) => {
      // alova onSuccess 已解包 { data: T }
      const entries = (res as { entries?: KbEntry[] })?.entries ?? []
      // 筛选已标记为删除的条目（软删除）
      const deleted = entries
        .filter((e) => (e as Record<string, unknown>).isDeleted === true)
        .map((e) => ({
          id: e.id,
          title: e.name,
          description: e.description ?? null,
          type: 'kb' as const,
          deletedAt: (e as Record<string, unknown>).deletedAt as string ?? new Date().toISOString(),
        }))
      setTrashItems(deleted)
    }).catch(() => {
      // error handled by useRequest
    })
  }, [])

  const handlePermanentDelete = async (id: string) => {
    setRemovingId(id)
    try {
      await removePermanently(id)
      setTrashItems((prev) => prev.filter((item) => item.id !== id))
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="h-full p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">回收站</h1>
          <p className="mt-1 text-sm text-text-secondary">
            已删除的会话和知识库文件 — 保留 30 天后自动清理
          </p>
        </div>
        <button
          onClick={() => { reload().catch(() => {}) }}
          disabled={loading}
          className="rounded-md px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-2 disabled:opacity-50"
        >
          {loading ? '刷新中...' : '刷新'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="mt-8 text-center text-sm text-text-secondary">加载中...</div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="mt-8 text-center">
          <p className="text-sm text-error">加载失败：{error.message || '未知错误'}</p>
          <button
            onClick={() => { reload().catch(() => {}) }}
            className="mt-3 text-sm text-brand-primary hover:underline"
          >
            重试
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && trashItems.length === 0 && (
        <div className="mt-12 text-center">
          <p className="text-3xl">🗑️</p>
          <p className="mt-3 text-sm font-medium text-text-secondary">回收站为空</p>
          <p className="mt-1 text-xs text-text-tertiary">
            删除的知识库或会话会显示在这里，可在 30 天内恢复
          </p>
        </div>
      )}

      {/* Trash list */}
      {!loading && !error && trashItems.length > 0 && (
        <div className="mt-6 space-y-2">
          {trashItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-md border border-border-default bg-surface-1 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs rounded bg-surface-3 px-1.5 py-0.5 text-text-tertiary">
                    {item.type === 'kb' ? '知识库' : '会话'}
                  </span>
                  <p className="truncate text-sm font-medium text-text-primary">
                    {item.title || '未命名'}
                  </p>
                </div>
                {item.description && (
                  <p className="mt-1 truncate text-xs text-text-tertiary">
                    {item.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-text-tertiary">
                  删除于 {new Date(item.deletedAt).toLocaleDateString('zh-CN')}
                </p>
              </div>
              <div className="ml-4 flex shrink-0 items-center gap-1">
                {/* 恢复按钮 — 需要后端 /api/knowledge-base/:id/restore 端点 */}
                <button
                  disabled
                  className="rounded p-1.5 text-text-tertiary transition-colors hover:bg-surface-2 disabled:opacity-40"
                  title="恢复功能需要后端支持"
                >
                  <RestoreIcon />
                </button>
                <button
                  onClick={() => handlePermanentDelete(item.id)}
                  disabled={removingId === item.id}
                  className="rounded p-1.5 text-text-tertiary transition-colors hover:bg-surface-2 hover:text-error disabled:opacity-50"
                  title="彻底删除"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  )
}

function TrashIcon() {
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
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}
