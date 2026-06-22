import { Card, List, Tag } from 'antd'
import { Activity, FileText, AlertCircle, Workflow } from 'lucide-react'
import type { RecentActivity } from '../services'

export interface RecentActivitiesProps {
  activities: RecentActivity[]
}

export function RecentActivities({ activities }: RecentActivitiesProps) {
  return (
    <Card title="最近活动" extra={<Tag color="blue">实时</Tag>}>
      <List
        dataSource={activities}
        locale={{ emptyText: '暂无活动' }}
        renderItem={(item: RecentActivity) => (
          <List.Item>
            <List.Item.Meta
              avatar={
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
                  {item.icon === 'login' && <Activity size={14} />}
                  {item.icon === 'create' && <FileText size={14} />}
                  {item.icon === 'delete' && <AlertCircle size={14} />}
                  {item.icon === 'rag' && <Workflow size={14} />}
                </div>
              }
              title={
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">{item.title}</span>
                  <span className="text-xs text-slate-400">
                    {formatRelative(item.time)}
                  </span>
                </div>
              }
              description={item.description}
            />
          </List.Item>
        )}
      />
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
