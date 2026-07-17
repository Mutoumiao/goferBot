/**
 * Companion 二级弹层壳：表单档 / 工作台档尺寸；禁止点遮罩关闭。
 *
 * 注意：shadcn DialogContent 默认 `grid`，工作台档必须用 `!flex` 覆盖，
 * 否则子级 flex/min-h-0 高度链断裂导致双栏错乱。
 */
import { XIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export type CompanionPanelTier = 'form' | 'workspace'

type CompanionPanelShellProps = {
  tier: CompanionPanelTier
  title: string
  description?: string
  children: ReactNode
  /** OverlayHost 注入 */
  onClose?: (result?: unknown) => void
  /** 关闭前拦截：返回 false 则不关 */
  onRequestClose?: () => boolean | Promise<boolean>
  className?: string
  contentClassName?: string
  /** 是否渲染标题区（默认 true） */
  showHeader?: boolean
}

async function allowClose(onRequestClose?: () => boolean | Promise<boolean>): Promise<boolean> {
  if (!onRequestClose) return true
  return Boolean(await onRequestClose())
}

export function CompanionPanelShell({
  tier,
  title,
  description,
  children,
  onClose,
  onRequestClose,
  className,
  contentClassName,
  showHeader = true,
}: CompanionPanelShellProps) {
  const requestClose = async () => {
    if (!(await allowClose(onRequestClose))) return
    onClose?.(false)
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) void requestClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn(
          // 强制覆盖默认 grid，建立稳定 flex 高度链
          '!flex flex-col gap-0 overflow-hidden p-0',
          tier === 'form' && 'max-h-[min(90vh,720px)] sm:max-w-lg',
          tier === 'workspace' &&
            'h-[min(85vh,720px)] w-[min(96vw,56rem)] max-w-[min(96vw,56rem)] sm:max-w-[min(96vw,56rem)]',
          className,
        )}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault()
          void requestClose()
        }}
      >
        {showHeader ? (
          <DialogHeader className="shrink-0 space-y-1 border-b border-border-subtle px-5 py-4 pr-12 text-left">
            <DialogTitle className="truncate pr-2">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="truncate">{description}</DialogDescription>
            ) : null}
          </DialogHeader>
        ) : (
          <span className="sr-only">
            <DialogTitle>{title}</DialogTitle>
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-3.5 right-3.5 z-10"
          aria-label="关闭"
          onClick={() => void requestClose()}
        >
          <XIcon className="h-4 w-4" />
        </Button>
        {/* 主体：不在壳上 overflow-y，由子级自己滚动，避免双栏被裁切/错位 */}
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col',
            showHeader ? '' : 'pt-2',
            contentClassName ?? 'overflow-y-auto px-5 py-4',
          )}
        >
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
