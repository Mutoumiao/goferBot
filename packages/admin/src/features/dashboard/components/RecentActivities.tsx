import { Card, List, Tag } from 'antd'
import { Activity, AlertCircle, FileText, Workflow } from 'lucide-react'
import type { RecentActivity } from '../services'

export interface RecentActivitiesProps {
  activities: RecentActivity[]
}

export function RecentActivities({ activities }: RecentActivitiesProps) {
  return (
    <Card title="最近活动" extra={<Tag color="blue">实时</Tag>}>
      {/* 最近活动列表 */}
    </Card>
  )
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds} 秒前`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}
