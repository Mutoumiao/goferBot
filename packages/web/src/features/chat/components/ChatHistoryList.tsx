import type { Pagination as PaginationType, Session } from '@goferbot/data'
import { ArrowRightIcon, MessageCircleIcon, Trash2Icon } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
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
        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            tabIndex={0}
            onClick={() => onResume(session)}
            className={cn(
              'group flex w-full cursor-pointer items-center gap-4 rounded-lg border border-border-default bg-surface-1 p-4 text-left shadow-sm transition-all',
              'hover:border-border-subtle hover:shadow',
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
              <p className="mt-1 text-xs text-text-tertiary">{session.messageCount ?? 0} 条消息</p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-[34px] w-[34px] rounded-full bg-surface-3 text-text-secondary opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(e) => onDelete(session, e)}
                disabled={deletingId === session.id}
                title="删除会话"
              >
                <Trash2Icon className="size-4" />
              </Button>
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-surface-3 text-text-secondary transition-colors group-hover:bg-surface-2">
                <ArrowRightIcon className="size-[15px]" />
              </div>
            </div>
          </button>
        ))}
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
