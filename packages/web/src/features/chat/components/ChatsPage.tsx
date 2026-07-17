import type { Session } from '@goferbot/data'
import { useResponsive } from 'ahooks'
import { PanelLeft } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useKeepAliveSilentRefresh } from '@/lib/route-keepalive'
import { cn } from '@/utils/cn'
import { useLazyChatHistory } from '../hooks'
import { confirmDeleteChatSession, fetchProviders } from '../services'
import { useChatStore } from '../store'
import { ChatEmptyHome } from './ChatEmptyHome'
import { ChatSessionPanel } from './ChatSessionPanel'
import { SessionListPanel } from './SessionListPanel'

const PAGE_SIZE = 50

/**
 * /chats 一级页：左会话列表 + 右会话区。
 *
 * 桌面应用模型：
 * - 选中会话存 chatStore.selectedSessionId（不写 URL）
 * - KeepAlive 缓存整页；二次进入无感刷新会话列表（有数据时不骨架）
 */
export function ChatsPage() {
  const responsive = useResponsive()
  const isWide = Boolean(responsive.large)

  const selectedId = useChatStore((s) => s.selectedSessionId)
  const setSelectedSessionId = useChatStore((s) => s.setSelectedSessionId)

  const [listOpen, setListOpen] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [page] = useState(1)

  const { sessions, loading, error, reload, load } = useLazyChatHistory(page, PAGE_SIZE)

  const loadRef = useRef(load)
  const reloadRef = useRef(reload)
  loadRef.current = load
  reloadRef.current = reload

  // 首次进入拉列表；二次切回静默 reload（SessionList 仅在 sessions 空时展示 loading）
  // 模型列表：首次必拉；二次进入若仍为空则强制重试
  useKeepAliveSilentRefresh(({ silent }) => {
    if (silent) {
      void reloadRef.current()
      if (useChatStore.getState().availableProviders.length === 0) {
        void fetchProviders({ force: true })
      }
    } else {
      void loadRef.current()
      void fetchProviders()
    }
  })

  useEffect(() => {
    if (!isWide) {
      setListOpen(!selectedId)
    } else {
      setListOpen(true)
    }
  }, [isWide, selectedId])

  const handleSelect = useCallback(
    (session: Session) => {
      setSelectedSessionId(session.id)
      if (!isWide) setListOpen(false)
    },
    [setSelectedSessionId, isWide],
  )

  function handleNewChat() {
    setSelectedSessionId(null)
    if (!isWide) setListOpen(false)
  }

  const handleDelete = useCallback(
    async (session: Session) => {
      await confirmDeleteChatSession(session, {
        onBefore: () => setDeletingId(session.id),
        onAfter: () => setDeletingId(null),
        onReload: () => {
          void reloadRef.current()
        },
      })
      if (useChatStore.getState().selectedSessionId === session.id) {
        setSelectedSessionId(null)
      }
    },
    [setSelectedSessionId],
  )

  const handleSessionInvalid = useCallback(() => {
    setSelectedSessionId(null)
    void reloadRef.current()
  }, [setSelectedSessionId])

  /** 新建会话后列表需出现新项（仅在有选中且列表里还没有时） */
  const prevSelectedIdRef = useRef<string | null>(selectedId)
  useEffect(() => {
    const prev = prevSelectedIdRef.current
    prevSelectedIdRef.current = selectedId
    if (!prev && selectedId) {
      const exists = sessions.some((s) => s.id === selectedId)
      if (!exists) {
        void reloadRef.current()
      }
    }
  }, [selectedId, sessions])

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden bg-transparent" data-testid="chats-page">
      {!isWide && listOpen && (
        <button
          type="button"
          className="absolute inset-0 z-20 bg-slate-900/40 backdrop-blur-[1px]"
          aria-label="关闭会话列表"
          onClick={() => setListOpen(false)}
        />
      )}

      <div
        className={cn(
          'z-30 h-full shrink-0 transition-[width,transform] duration-200 ease-out',
          isWide
            ? listOpen
              ? 'w-[300px]'
              : 'w-0 overflow-hidden'
            : cn(
                'absolute inset-y-0 left-0 w-[min(300px,88vw)] shadow-2xl shadow-slate-900/10',
                listOpen ? 'translate-x-0' : '-translate-x-full',
              ),
        )}
      >
        <SessionListPanel
          sessions={sessions}
          selectedId={selectedId ?? undefined}
          loading={loading && sessions.length === 0}
          error={error}
          deletingId={deletingId}
          onSelect={handleSelect}
          onNewChat={handleNewChat}
          onDelete={handleDelete}
          onRetry={() => {
            void reloadRef.current()
          }}
          className="w-full"
        />
      </div>

      <div className="relative min-w-0 flex-1 bg-surface-1">
        {!listOpen && (
          <div className="absolute left-3 top-3 z-10">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9 rounded-xl border-border-default bg-surface-1 shadow-sm"
              onClick={() => setListOpen(true)}
              title="展开会话列表"
              aria-label="展开会话列表"
              data-testid="open-session-list"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        {selectedId ? (
          <ChatSessionPanel sessionId={selectedId} onSessionInvalid={handleSessionInvalid} />
        ) : (
          <ChatEmptyHome />
        )}
      </div>
    </div>
  )
}
