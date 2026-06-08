import { useChatStore } from '@/stores/chat'
import {
  PlusIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import type { Session } from '@goferbot/data'

interface SessionListProps {
  onRenameClick?: (session: Session) => void
  onDeleteClick?: (session: Session) => void
}

export function SessionList({ onRenameClick, onDeleteClick }: SessionListProps) {
  const sessions = useChatStore((s) => s.sessions)
  const activeSession = useChatStore((s) => s.activeSession)
  const isLoadingSessions = useChatStore((s) => s.isLoadingSessions)
  const error = useChatStore((s) => s.error)
  const createSession = useChatStore((s) => s.createSession)
  const setActiveSession = useChatStore((s) => s.setActiveSession)
  const loadSessions = useChatStore((s) => s.loadSessions)
  const clearError = useChatStore((s) => s.clearError)

  return (
    <div className="flex h-full flex-col border-r border-border-default bg-surface-1">
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <h2 className="text-sm font-medium text-text-primary">会话</h2>
        <button
          data-testid="new-session-btn"
          onClick={() => createSession()}
          className="rounded p-1 text-text-secondary hover:bg-surface-2 hover:text-text-primary"
        >
          <PlusIcon className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoadingSessions && (
          <div className="space-y-2 p-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        )}

        {!isLoadingSessions && error && (
          <div className="space-y-2 p-4 text-center text-sm">
            <p className="text-text-secondary">{error}</p>
            <button
              data-testid="session-list-retry"
              className="text-brand-primary hover:underline"
              onClick={() => {
                clearError()
                loadSessions()
              }}
            >
              重试
            </button>
          </div>
        )}

        {!isLoadingSessions && !error && sessions.length === 0 && (
          <div className="p-4 text-center text-sm text-text-tertiary">
            暂无会话
          </div>
        )}

        {!isLoadingSessions && !error && sessions.map((session) => {
          const sessionDate = session.createdAt ? new Date(session.createdAt) : null
          return (
            <div
              key={session.id}
              data-testid="session-item"
              onClick={() => setActiveSession(session)}
              className={cn(
                'group mx-2 my-0.5 cursor-pointer rounded-lg px-3 py-2.5 transition-colors',
                activeSession?.id === session.id
                  ? 'bg-surface-2 text-text-primary'
                  : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
              )}
            >
              <div className="flex items-center gap-2">
                <MessageCircleIcon className="size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{session.title}</span>
                  {sessionDate && (
                    <span className="block text-xs text-text-tertiary">
                      {sessionDate.toLocaleDateString('zh-CN')}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {session.messageCount > 0 && (
                    <span className="text-xs text-text-tertiary">
                      {session.messageCount}
                    </span>
                  )}
                  <div className="relative">
                    <button
                      data-testid="session-more-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        // 显示操作菜单
                        const menu = e.currentTarget.nextElementSibling as HTMLDivElement | null
                        if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none'
                      }}
                      className="rounded p-0.5 text-text-tertiary opacity-0 transition-opacity hover:bg-surface-3 hover:text-text-primary group-hover:opacity-100"
                    >
                      <MoreHorizontalIcon className="size-4" />
                    </button>
                    <div className="absolute right-0 top-full z-10 hidden min-w-[120px] rounded-md border border-border-default bg-surface-1 py-1 shadow-lg">
                      <button
                        data-testid="session-rename-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          onRenameClick?.(session)
                        }}
                        className="flex w-full items-center px-3 py-1.5 text-sm text-text-primary hover:bg-surface-2"
                      >
                        <PencilIcon className="mr-2 size-4" />
                        重命名
                      </button>
                      <button
                        data-testid="session-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteClick?.(session)
                        }}
                        className="flex w-full items-center px-3 py-1.5 text-sm text-destructive hover:bg-surface-2"
                      >
                        <Trash2Icon className="mr-2 size-4" />
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
