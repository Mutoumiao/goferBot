import { Empty, Button } from 'antd'
import { Inbox } from 'lucide-react'

export interface EmptyStateProps {
  description?: string
  actionText?: string
  onAction?: () => void
  icon?: React.ReactNode
}

export function EmptyState({
  description = '暂无数据',
  actionText,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center py-16">
      {icon ?? <Inbox className="mb-4 h-16 w-16 text-slate-300" />}
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={<span className="text-text-secondary">{description}</span>}
      />
      {actionText && onAction && (
        <Button type="primary" className="mt-4" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  )
}
