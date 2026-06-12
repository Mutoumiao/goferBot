import { useState, useCallback } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Clock3Icon, ChevronDownIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { confirmDeleteChatSession } from '@/features/chat/services'
import { useChatHistory } from '@/features/chat/hooks'
import { ChatHistoryList } from './ChatHistoryList'
import type { Session } from '@goferbot/data'
import { ROUTES_REGISTER } from '@/router-register'

const PAGE_SIZE = 10

export function ChatHistoryPage() {
  const router = useRouter()

  const [page, setPage] = useState(1)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { sessions, total, loading, error, reload } = useChatHistory(page, PAGE_SIZE)

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

  return (
    <div className="h-full p-8">
      <div className="mx-auto max-w-[880px]">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[28px] font-medium leading-tight text-text-primary">会话历史</h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              点击任意记录即可恢复到对应会话，继续追问、整理或查看引用来源。
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-[34px] gap-2 rounded-full border-border-default bg-surface-1/60 px-3 text-xs font-normal hover:bg-surface-1"
              >
                <Clock3Icon className="size-3.5 text-muted-foreground" />
                <span>全部会话</span>
                <ChevronDownIcon className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>全部会话</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            pageSize={PAGE_SIZE}
            total={total}
            deletingId={deletingId}
            onResume={handleResume}
            onDelete={handleDelete}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  )
}
