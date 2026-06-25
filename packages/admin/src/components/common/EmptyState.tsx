import { Empty, Button, Space, Alert } from 'antd'
import { Inbox, RefreshCw, AlertCircle } from 'lucide-react'

export interface EmptyStateProps {
  description?: string
  actionText?: string
  onAction?: () => void
  icon?: React.ReactNode
  error?: string
  onRetry?: () => void
  retryText?: string
}

export function EmptyState({
  description = '暂无数据',
  actionText,
  onAction,
  icon,
  error,
  onRetry,
  retryText = '重试',
}: EmptyStateProps) {
  if (error) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center py-16">
        <AlertCircle className="mb-4 h-12 w-12 text-red-300" />
        <Alert
          type="error"
          showIcon
          message={<span className="text-sm">{error}</span>}
          className="mb-4 max-w-md"
        />
        <Space>
          {onRetry && (
            <Button type="primary" icon={<RefreshCw size={14} />} onClick={onRetry}>
              {retryText}
            </Button>
          )}
          {actionText && onAction && <Button onClick={onAction}>{actionText}</Button>}
        </Space>
      </div>
    )
  }

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
