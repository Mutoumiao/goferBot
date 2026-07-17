import type { Session } from '@goferbot/data'
import { MessageCircle, MessageSquareText, MoreHorizontal, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/cn'

type DayBucket = 'today' | 'yesterday' | 'earlier'

function dayBucket(iso: string | undefined): DayBucket {
  if (!iso) return 'earlier'
  const date = new Date(iso)
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startYesterday = new Date(startToday)
  startYesterday.setDate(startYesterday.getDate() - 1)
  if (date >= startToday) return 'today'
  if (date >= startYesterday) return 'yesterday'
  return 'earlier'
}

const BUCKET_LABEL: Record<DayBucket, string> = {
  today: '今天',
  yesterday: '昨天',
  earlier: '更早',
}

export interface SessionListPanelProps {
  sessions: Session[]
  selectedId?: string
  loading?: boolean
  error?: Error | string | null
  deletingId?: string | null
  onSelect: (session: Session) => void
  onNewChat: () => void
  onDelete?: (session: Session) => void
  onRetry?: () => void
  className?: string
}

/**
 * 300px 会话列表面板：智能对话入口 + 按时间分组的历史会话。
 */
export function SessionListPanel({
  sessions,
  selectedId,
  loading,
  error,
  deletingId,
  onSelect,
  onNewChat,
  onDelete,
  onRetry,
  className,
}: SessionListPanelProps) {
  const isHomeActive = !selectedId

  const grouped = useMemo(() => {
    const buckets: Record<DayBucket, Session[]> = {
      today: [],
      yesterday: [],
      earlier: [],
    }
    for (const s of sessions) {
      buckets[dayBucket(s.updatedAt ?? s.createdAt)].push(s)
    }
    return (['today', 'yesterday', 'earlier'] as DayBucket[])
      .map((key) => ({ key, label: BUCKET_LABEL[key], items: buckets[key] }))
      .filter((g) => g.items.length > 0)
  }, [sessions])

  return (
    <aside
      className={cn(
        'flex h-full w-full flex-col border-r border-border-panel bg-surface-1',
        className,
      )}
      data-testid="session-list-panel"
    >
      <div className="flex items-center px-3 pb-1 pt-4">
        <h2 className="pl-1 text-[13px] font-semibold tracking-tight text-text-primary">对话</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3 pt-1">
        <button
          type="button"
          onClick={onNewChat}
          className={cn(
            'mb-3 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors',
            isHomeActive
              ? 'bg-brand-blue-soft text-brand-blue ring-1 ring-brand-blue/15'
              : 'text-text-primary hover:bg-surface-2',
          )}
          data-testid="session-home-entry"
          data-active={isHomeActive ? 'true' : undefined}
          aria-current={isHomeActive ? 'true' : undefined}
        >
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              isHomeActive ? 'bg-white text-brand-blue' : 'bg-surface-2 text-text-tertiary',
            )}
          >
            <MessageSquareText className="h-4 w-4" />
          </span>
          <span className={cn('min-w-0 flex-1 truncate text-sm', isHomeActive && 'font-semibold')}>
            智能对话
          </span>
        </button>

        {loading && (
          <div className="space-y-2 px-1" data-testid="session-list-loading">
            {[1, 2, 3, 4, 5].map((k) => (
              <Skeleton key={k} className="h-10 w-full rounded-xl bg-surface-2" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="px-3 py-8 text-center" data-testid="session-list-error">
            <p className="text-sm text-error">
              {typeof error === 'string' ? error : error.message || '加载失败'}
            </p>
            {onRetry && (
              <Button variant="link" className="mt-2 text-brand-blue" onClick={onRetry}>
                重试
              </Button>
            )}
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div className="px-3 py-10 text-center" data-testid="session-list-empty">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-border-subtle bg-surface-1 text-text-tertiary">
              <MessageCircle className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-medium text-text-primary">暂无历史会话</p>
            <p className="mt-1 text-xs text-text-tertiary">从「智能对话」开始提问</p>
          </div>
        )}

        {!loading && !error && sessions.length > 0 && (
          <div className="space-y-3">
            {grouped.map((group) => (
              <section key={group.key}>
                <h3 className="mb-1 px-2 text-[11px] font-medium text-text-tertiary">
                  {group.label}
                </h3>
                <ul className="space-y-0.5">
                  {group.items.map((session) => {
                    const active = session.id === selectedId
                    return (
                      <li key={session.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => onSelect(session)}
                          className={cn(
                            'relative flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors',
                            active
                              ? 'bg-brand-blue-soft text-brand-blue'
                              : 'text-text-primary hover:bg-surface-2',
                          )}
                          aria-current={active ? 'true' : undefined}
                          data-testid={`session-item-${session.id}`}
                          data-active={active ? 'true' : undefined}
                        >
                          {active && (
                            <span
                              className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand-blue"
                              aria-hidden
                            />
                          )}
                          <span
                            className={cn(
                              'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                              active ? 'text-brand-blue' : 'text-text-tertiary',
                            )}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </span>
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate text-[13px]',
                              active ? 'font-semibold' : 'font-medium',
                            )}
                          >
                            {session.title?.trim() || '未命名会话'}
                          </span>
                        </button>

                        {onDelete && (
                          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary hover:bg-surface-3"
                                  aria-label="会话操作"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-36">
                                <DropdownMenuItem
                                  variant="destructive"
                                  disabled={deletingId === session.id}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onDelete(session)
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  删除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
