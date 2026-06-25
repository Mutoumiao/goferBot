import { Card, Progress, Tag } from 'antd'
import { CheckCircle2 } from 'lucide-react'
import type { SystemHealth } from '../services'

export interface SystemHealthProps {
  health?: SystemHealth
}

export function SystemHealth({ health }: SystemHealthProps) {
  return (
    <Card title="系统健康状态">
      {health ? (
        <div className="space-y-4">
          <HealthRow name="CPU 使用率" value={health.cpu} />
          <HealthRow name="内存占用" value={health.memory} />
          <HealthRow name="磁盘空间" value={health.disk} />
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-slate-600">服务状态</span>
              <span className="flex items-center gap-1 text-emerald-500">
                <CheckCircle2 size={14} />
                正常
              </span>
            </div>
            <div className="flex gap-2">
              <Tag color="green">API</Tag>
              <Tag color="green">数据库</Tag>
              <Tag
                color={
                  health.queueStatus === 'running'
                    ? 'green'
                    : health.queueStatus === 'idle'
                      ? 'default'
                      : 'red'
                }
              >
                队列
              </Tag>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-center py-8 text-slate-400">加载中...</div>
      )}
    </Card>
  )
}

function HealthRow({ name, value }: { name: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-slate-600">{name}</span>
        <span
          className={`font-medium ${
            value > 85 ? 'text-red-500' : value > 70 ? 'text-orange-500' : 'text-green-500'
          }`}
        >
          {value}%
        </span>
      </div>
      <Progress
        percent={value}
        strokeColor={value > 85 ? '#ef4444' : value > 70 ? '#f59e0b' : '#10b981'}
        showInfo={false}
      />
    </div>
  )
}
