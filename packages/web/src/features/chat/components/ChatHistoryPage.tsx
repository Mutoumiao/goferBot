import type { Session } from '@goferbot/data'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useLazyChatHistory } from '@/features/chat/hooks'
import { confirmDeleteChatSession } from '@/features/chat/services'
import { tabManager } from '@/stores/tabManager'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { ChatHistoryList } from './ChatHistoryList'

const PAGE_SIZE = 6

export function ChatHistoryPage() {
  const [page, setPage] = useState(1)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { sessions, pagination, loading, error, reload, load } = useLazyChatHistory(page, PAGE_SIZE)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    loadRef.current()
  }, [])

  const handleResume = useCallback((session: Session) => {
    void tabManager.openConversation(session.id, session.title ?? undefined)
  }, [])

  const handleDelete = useCallback(
    async (session: Session, e?: React.MouseEvent) => {
      e?.stopPropagation()
      await confirmDeleteChatSession(session, {
        onBefore: () => setDeletingId(session.id),
        onAfter: () => {
          setDeletingId(null)
          const tab = useWorkspaceStore.getState().findTabByConversationId(session.id)
          if (tab) {
            useWorkspaceStore
              .getState()
              .updateTab(tab.id, { conversationId: undefined, title: '新会话' })
          }
        },
        onReload: () => reload(),
      })
    },
    [reload],
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
            {[1, 2, 3, 4].map((key) => (
              <div
                key={`skeleton-${key}`}
                className="h-[76px] w-full animate-pulse rounded-lg bg-surface-3"
              />
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
