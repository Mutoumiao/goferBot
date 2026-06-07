import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useRequest } from 'alova/client'
import { getSessions, deleteSession } from '@/api/chat'
import { useChatStore } from '@/stores/chat'
import type { Session } from '@goferbot/data'

export const Route = createFileRoute('/app/history')({
  component: HistoryPage,
})

function HistoryPage() {
  const setActiveSession = useChatStore((s) => s.setActiveSession)
  const activeSession = useChatStore((s) => s.activeSession)

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const {
    data,
    loading,
    error,
    send: reload,
  } = useRequest(() => getSessions(), { immediate: true })

  const { send: removeSession } = useRequest(
    (id: string) => deleteSession(id),
    { immediate: false },
  )

  // alova onSuccess 已解包 { data: T } → 直接访问 sessions
  const response = data as { sessions?: Session[] } | undefined
  const sessions = response?.sessions ?? []

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await removeSession(id)
      reload()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="h-full p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">历史会话</h1>
          <p className="mt-1 text-sm text-text-secondary">查看和管理你的历史对话记录</p>
        </div>
        <button
          onClick={() => reload()}
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
            onClick={() => reload()}
            className="mt-3 text-sm text-brand-primary hover:underline"
          >
            重试
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && sessions.length === 0 && (
        <div className="mt-8 text-center text-text-secondary">
          <p className="text-lg">🕐</p>
          <p className="mt-2">暂无历史会话</p>
          <p className="mt-1 text-xs text-text-tertiary">开始新对话后，会话记录将显示在这里</p>
        </div>
      )}

      {/* Session list */}
      {!loading && !error && sessions.length > 0 && (
        <div className="mt-6 space-y-1">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setActiveSession(session)}
              className={[
                'flex items-center justify-between rounded-md px-3 py-2.5 cursor-pointer transition-colors',
                'hover:bg-surface-3',
                activeSession?.id === session.id
                  ? 'bg-surface-3 border border-border-default'
                  : 'border border-transparent',
              ].join(' ')}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">
                  {session.title || '未命名会话'}
                </p>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  {session.messageCount ?? 0} 条消息
                  {session.updatedAt && (
                    <> · {new Date(session.updatedAt).toLocaleDateString('zh-CN')}</>
                  )}
                </p>
              </div>
              <button
                onClick={(e) => handleDelete(session.id, e)}
                disabled={deletingId === session.id}
                className="ml-3 shrink-0 rounded p-1 text-text-tertiary hover:text-error hover:bg-surface-2 disabled:opacity-50"
                title="删除会话"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** 内联 SVG 垃圾桶图标 */
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
