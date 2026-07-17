import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

/**
 * 设置类页面表面：透明底（露出舞台 #F0F2F7），居中固定宽度，移动端 item 列表风格。
 * 业务白卡由 WorkspaceStage 在壳层统一挂载，设置类页不要再套 gofer-workspace-card。
 */
export function SettingsSurface({
  children,
  className,
  contentClassName,
  maxWidthClassName = 'max-w-[925px]',
  testId,
}: {
  children: ReactNode
  className?: string
  contentClassName?: string
  maxWidthClassName?: string
  testId?: string
}) {
  return (
    <div
      className={cn('h-full w-full overflow-auto bg-transparent', className)}
      data-testid={testId}
    >
      <div className={cn('mx-auto px-6 py-8 md:px-10', maxWidthClassName, contentClassName)}>
        {children}
      </div>
    </div>
  )
}
