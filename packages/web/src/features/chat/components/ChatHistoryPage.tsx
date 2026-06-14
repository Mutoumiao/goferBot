import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { confirmDeleteChatSession } from '@/features/chat/services'
import { useLazyChatHistory } from '@/features/chat/hooks'
import { ChatHistoryList } from './ChatHistoryList'
import type { Session } from '@goferbot/data'
import { ROUTES_REGISTER } from '@/router-register'

const PAGE_SIZE = 6

export function ChatHistoryPage() {
  const router = useRouter()

  const [page, setPage] = useState(1)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { sessions, pagination, loading, error, reload, load } = useLazyChatHistory(page, PAGE_SIZE)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    loadRef.current()
  }, [page])

  const handleResume = useCallback(
    (session: Session) => {
      router.navigate({ to: ROUTES_REGISTER.chat.bindTo?.(session.id) })
    },
    [router]
  )

  const handleDelete = useCallback(
    async (session: Session, e?: React.MouseEvent) => {
      e?.stopPropagation()
      await confirmDeleteChatSession(session, {
        onBefore: () => setDeletingId(session.id),
        onAfter: () => setDeletingId(null),
        onReload: () => reload(),
      })
    },
    [reload]
  )

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  return (
    <div className="p-8 h-auto">
      <div className="mx-auto max-w-[880px]">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[28px] font-medium leading-tight text-text-primary">会话历史</h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              点击任意记录即可恢复到对应会话，继续追问、整理或查看引用来源。
            </p>
          </div>
        </div>

        {loading && (
          <div className="mt-6 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[76px] w-full animate-pulse rounded-lg bg-surface-3" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="mt-8 text-center">
            <p className="text-sm text-error">加载失败：{error.message || '未知错误'}</p>
            <Button variant="link" onClick={() => reload()} className="mt-2">
              重试
            </Button>
          </div>
        )}

        {!loading && !error && (
          <ChatHistoryList
            sessions={sessions}
            page={page}
            pagination={pagination}
            deletingId={deletingId}
            onResume={handleResume}
            onDelete={handleDelete}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>
  )
}
