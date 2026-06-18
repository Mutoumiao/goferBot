import type { Session } from '@goferbot/data'
import {
  MessageCircleIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/utils/cn'
import { createChatSession, loadChatSessions } from '../services'
import { useChatStore } from '../store'

interface ChatSessionListProps {
  onRenameClick?: (session: Session) => void
  onDeleteClick?: (session: Session) => void
}

export function ChatSessionList({ onRenameClick, onDeleteClick }: ChatSessionListProps) {
  const sessions = useChatStore((s) => s.sessions)
  const activeSession = useChatStore((s) => s.activeSession)
  const isLoadingSessions = useChatStore((s) => s.isLoadingSessions)
  const error = useChatStore((s) => s.error)
  const setActiveSession = useChatStore((s) => s.setActiveSession)
  const clearError = useChatStore((s) => s.clearError)

  return (
    <div className="flex h-full flex-col border-r border-border-default bg-surface-1">
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <h2 className="text-sm font-medium text-text-primary">会话</h2>
        <Button
          data-testid="new-session-btn"
          variant="ghost"
          size="icon-sm"
          onClick={() => createChatSession()}
        >
          <PlusIcon className="size-4" />
        </Button>
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
            <Button
              data-testid="session-list-retry"
              variant="link"
              onClick={() => {
                clearError()
                loadChatSessions()
              }}
            >
              重试
            </Button>
          </div>
        )}

        {!isLoadingSessions && !error && sessions.length === 0 && (
          <div className="p-4 text-center text-sm text-text-tertiary">暂无会话</div>
        )}

        {!isLoadingSessions &&
          !error &&
          sessions.map((session) => {
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
                      <span className="text-xs text-text-tertiary">{session.messageCount}</span>
                    )}
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            data-testid="session-more-btn"
                            variant="ghost"
                            size="icon-xs"
                            className="opacity-0 group-hover:opacity-100"
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            data-testid="session-rename-btn"
                            onClick={() => onRenameClick?.(session)}
                          >
                            <PencilIcon className="mr-2 size-4" />
                            重命名
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            data-testid="session-delete-btn"
                            variant="destructive"
                            onClick={() => onDeleteClick?.(session)}
                          >
                            <Trash2Icon className="mr-2 size-4" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
