import { Badge } from '@/components/ui/badge'
import type { CompanionStatus } from '../types'

interface CompanionStatusTagProps {
  status: CompanionStatus
}

const STATUS_MAP: Record<CompanionStatus, { variant: 'default' | 'secondary' | 'destructive'; label: string }> = {
  draft: { variant: 'default', label: '草稿' },
  published: { variant: 'secondary', label: '已发布' },
  archived: { variant: 'destructive', label: '已归档' },
}

export function CompanionStatusTag({ status }: CompanionStatusTagProps) {
  const config = STATUS_MAP[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}
