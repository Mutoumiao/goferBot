import { cn } from '@/utils/cn'

interface ChatPendingIndicatorProps {
  /** 提示文案 */
  label?: string
  className?: string
  /** data-testid 覆盖 */
  testId?: string
}

/**
 * 对话首 token 前的等待态：三点跳动 + 文案。
 * Knowledge Chat / Companion 共用，避免长耗时检索/管线阶段界面「死机」感。
 */
export function ChatPendingIndicator({
  label = '正在生成…',
  className,
  testId = 'chat-pending-indicator',
}: ChatPendingIndicatorProps) {
  return (
    <div
      className={cn('flex items-center gap-2.5 text-sm text-text-secondary', className)}
      data-testid={testId}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="inline-flex items-center gap-1" aria-hidden>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
      </span>
      <span>{label}</span>
    </div>
  )
}
