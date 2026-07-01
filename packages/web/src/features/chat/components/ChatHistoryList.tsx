import type { Pagination as PaginationType, Session } from '@goferbot/data'
import { ArrowRightIcon, MoreHorizontalIcon, MessageCircleIcon, Trash2Icon } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { cn } from '@/utils/cn'

function formatSessionTime(iso: string | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  const timeStr = date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (isToday) return `今天 ${timeStr}`
  if (isYesterday) return `昨天 ${timeStr}`

  const currentYear = now.getFullYear()
  const sessionYear = date.getFullYear()
  if (sessionYear === currentYear) {
    return `${date.getMonth() + 1} 月 ${date.getDate()} 日`
  }
  return `${sessionYear} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

interface ChatHistoryListProps {
  sessions: Session[]
  page: number
  pagination: PaginationType | null
  deletingId?: string | null
  onResume: (session: Session) => void
  onDelete: (session: Session, e?: React.MouseEvent) => void
  onPageChange: (page: number) => void
}

export function ChatHistoryList({
  sessions,
  page,
  pagination,
  deletingId,
  onResume,
  onDelete,
  onPageChange,
}: ChatHistoryListProps) {
  const totalPages = pagination?.totalPage ?? 1

  const paginationItems = useMemo(() => {
    const items: { key: string; value: number | 'ellipsis' }[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) items.push({ key: String(i), value: i })
    } else {
      items.push({ key: '1', value: 1 })
      if (page > 3) items.push({ key: 'ellipsis-start', value: 'ellipsis' })
      const start = Math.max(2, page - 1)
      const end = Math.min(totalPages - 1, page + 1)
      for (let i = start; i <= end; i++) items.push({ key: String(i), value: i })
      if (page < totalPages - 2) items.push({ key: 'ellipsis-end', value: 'ellipsis' })
      items.push({ key: String(totalPages), value: totalPages })
    }
    return items
  }, [page, totalPages])

  const handlePrevious = useCallback(() => {
    onPageChange(Math.max(1, page - 1))
  }, [onPageChange, page])

  const handleNext = useCallback(() => {
    onPageChange(Math.min(totalPages, page + 1))
  }, [onPageChange, page, totalPages])

  const handleCardKeyDown = useCallback(
    (session: Session, e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onResume(session)
      }
    },
    [onResume],
  )

  if (sessions.length === 0) {
    return (
      <Empty className="mt-8 min-h-[320px] rounded-xl border border-dashed border-border-default bg-surface-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageCircleIcon className="size-6 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>暂无历史会话</EmptyTitle>
          <EmptyDescription>开始新对话后，会话记录将显示在这里</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      <div className="mt-6 space-y-2.5">
        {sessions.map((session) => {
          const isDeleting = deletingId === session.id
          return (
            <div
              key={session.id}
              role="button"
              tabIndex={0}
              aria-label={`恢复会话 ${session.title || '未命名会话'}`}
              onClick={() => onResume(session)}
              onKeyDown={(e) => handleCardKeyDown(session, e)}
              className={cn(
                'group relative flex w-full cursor-pointer items-center gap-4 rounded-lg border border-border-default bg-surface-1 p-4 text-left shadow-sm transition-all',
                'hover:border-border-subtle hover:shadow',
                isDeleting && 'pointer-events-none opacity-60',
              )}
            >
              <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-2xl bg-brand-blue-soft">
                <MessageCircleIcon className="size-[19px] text-brand-blue" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-text-primary">
                  {session.title || '未命名会话'}
                </p>
                <p className="mt-1 line-clamp-1 text-xs text-text-secondary">
                  {session.messageCount ?? 0} 条消息
                </p>
              </div>

              <div className="hidden shrink-0 text-right sm:block">
                <p className="text-xs text-text-tertiary">
                  {formatSessionTime(session.updatedAt ?? session.createdAt)}
                </p>
                <p className="mt-1 text-xs text-text-tertiary">
                  {session.messageCount ?? 0} 条消息
                </p>
              </div>

              <div
                className="flex shrink-0 items-center gap-2"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      data-testid={`session-menu-trigger-${session.id}`}
                      className={cn(
                        'h-[34px] w-[34px] rounded-full bg-surface-3 text-text-secondary transition-opacity',
                        'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                      )}
                      title="更多操作"
                      aria-label={`会话 ${session.title || '未命名会话'} 的更多操作`}
                      disabled={isDeleting}
                    >
                      <MoreHorizontalIcon className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[160px]">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        onResume(session)
                      }}
                    >
                      <ArrowRightIcon className="mr-2 size-4" />
                      恢复会话
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={isDeleting}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(session, e)
                      }}
                    >
                      <Trash2Icon className="mr-2 size-4" />
                      删除会话
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 mb-10 flex justify-center">
          <Pagination>
            <PaginationContent className="rounded-full border border-border-default bg-surface-1 p-1 shadow-sm">
              <PaginationItem>
                <PaginationPrevious
                  onClick={handlePrevious}
                  className={cn(
                    'rounded-full border-0',
                    page === 1 && 'pointer-events-none opacity-50',
                  )}
                  text="上一页"
                />
              </PaginationItem>
              {paginationItems.map((item) =>
                item.value === 'ellipsis' ? (
                  <PaginationItem key={item.key}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item.key}>
                    <PaginationLink
                      isActive={item.value === page}
                      onClick={() => onPageChange(item.value as number)}
                      className={cn(
                        'h-7 w-7 rounded-full border-0 p-0 text-[13px]',
                        item.value === page
                          ? 'bg-brand-blue-soft text-brand-blue ring-1 ring-brand-blue-ring'
                          : 'text-text-secondary hover:bg-surface-3',
                      )}
                    >
                      {item.value}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <PaginationNext
                  onClick={handleNext}
                  className={cn(
                    'rounded-full border-0',
                    page === totalPages && 'pointer-events-none opacity-50',
                  )}
                  text="下一页"
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </>
  )
}
