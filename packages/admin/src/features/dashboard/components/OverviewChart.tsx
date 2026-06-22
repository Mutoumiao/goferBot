import { Card, Progress } from 'antd'
import { Clock, CheckCircle2, AlertCircle, PauseCircle } from 'lucide-react'
import type { DashboardData } from '../services'

export interface OverviewChartProps {
  ragStats?: DashboardData['ragStats']
}

export function OverviewChart({ ragStats }: OverviewChartProps) {
  return (
    <Card title="RAG 任务分布">
      <div className="space-y-3">
        <TaskBar
          label="运行中"
          count={ragStats?.running ?? 0}
          total={ragStats?.total ?? 1}
          color="#3b82f6"
          icon={<Clock size={12} className="text-blue-500" />}
        />
        <TaskBar
          label="成功"
          count={ragStats?.succeeded ?? 0}
          total={ragStats?.total ?? 1}
          color="#10b981"
          icon={<CheckCircle2 size={12} className="text-green-500" />}
        />
        <TaskBar
          label="失败"
          count={ragStats?.failed ?? 0}
          total={ragStats?.total ?? 1}
          color="#ef4444"
          icon={<AlertCircle size={12} className="text-red-500" />}
        />
        <TaskBar
          label="已排队"
          count={ragStats?.pending ?? 0}
          total={ragStats?.total ?? 1}
          color="#f59e0b"
          icon={<PauseCircle size={12} className="text-amber-500" />}
        />
      </div>
    </Card>
  )
}

function TaskBar({
  label,
  count,
  total,
  color,
  icon,
}: {
  label: string
  count: number
  total: number
  color: string
  icon: React.ReactNode
}) {
  const percent = total === 0 ? 0 : Math.round((count / total) * 100)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="flex items-center gap-1 text-slate-600">
          {icon}
          {label}
        </span>
        <span className="font-medium text-slate-700">
          {count} <span className="text-slate-400">({percent}%)</span>
        </span>
      </div>
      <Progress percent={percent} strokeColor={color} showInfo={false} />
    </div>
  )
}
