import { Button, Space } from 'antd'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  description?: string
  onBack?: () => void
  extra?: ReactNode
}

export function PageHeader({ title, description, onBack, extra }: PageHeaderProps) {
  return (
    <div className="mb-4 flex items-start justify-between border-b border-border-subtle pb-4">
      <div className="flex items-start gap-3">
        {onBack && (
          <Button type="text" icon={<ArrowLeft size={16} />} onClick={onBack}>
            返回
          </Button>
        )}
        <div>
          <h1 className="m-0 text-xl font-semibold text-text-primary">{title}</h1>
          {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
        </div>
      </div>
      {extra && <Space>{extra}</Space>}
    </div>
  )
}
