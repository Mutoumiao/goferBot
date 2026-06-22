import { Tag } from 'antd'

export type StatusType = 'success' | 'warning' | 'error' | 'default' | 'processing'

export interface StatusTagProps {
  status: StatusType
  text?: string
  children?: React.ReactNode
}

const STATUS_COLOR_MAP: Record<StatusType, string> = {
  success: 'green',
  warning: 'orange',
  error: 'red',
  default: 'default',
  processing: 'blue',
}

export function StatusTag({ status, text, children }: StatusTagProps) {
  return <Tag color={STATUS_COLOR_MAP[status]}>{text ?? children ?? status}</Tag>
}
