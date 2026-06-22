import { Card, Col, Row, Statistic, Progress, List, Tag, Spin } from 'antd'
import {
  Users,
  MessageSquare,
  FileText,
  Workflow,
  TrendingUp,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import type { DashboardData, RecentActivity } from '../services'

export interface DashboardViewProps {
  data?: DashboardData
  loading?: boolean
  onRefresh?: () => void
}

export function DashboardView({ data, loading, onRefresh }: DashboardViewProps) {
  const stats = data?.stats
  const activities = data?.activities ?? []
  const health = data?.health

  const formatNumber = (n: number) => {
    if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
    return n.toLocaleString()
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="控制台"
        description="查看系统整体运行状态与核心指标"
        extra={<button onClick={onRefresh}>刷新</button>}
      />

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable>
              <Statistic
                title="用户总数"
                value={formatNumber(stats?.userCount ?? 0)}
                prefix={<Users className="text-indigo-500" size={16} />}
                valueStyle={{ color: '#4f46e5', fontSize: 24 }}
              />
              <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                <TrendingUp size={12} />+{stats?.userGrowth ?? 0}% 较上周
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable>
              <Statistic
                title="会话总数"
                value={formatNumber(stats?.sessionCount ?? 0)}
                prefix={<MessageSquare className="text-emerald-500" size={16} />}
                valueStyle={{ color: '#10b981', fontSize: 24 }}
              />
              <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                <TrendingUp size={12} />+{stats?.sessionGrowth ?? 0}% 较上周
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable>
              <Statistic
                title="文档总数"
                value={formatNumber(stats?.documentCount ?? 0)}
                prefix={<FileText className="text-amber-500" size={16} />}
                valueStyle={{ color: '#f59e0b', fontSize: 24 }}
              />
              <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                <TrendingUp size={12} />+{stats?.documentGrowth ?? 0}% 较上周
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable>
              <Statistic
                title="RAG 任务数"
                value={formatNumber(stats?.ragTaskCount ?? 0)}
                prefix={<Workflow className="text-rose-500" size={16} />}
                valueStyle={{ color: '#f43f5e', fontSize: 24 }}
              />
              <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                <TrendingUp size={12} />+{stats?.ragTaskGrowth ?? 0}% 较上周
              </div>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} className="mt-2">
          <Col xs={24} lg={14}>
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
          </Col>

          <Col xs={24} lg={10}>
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
                        <CheckCircle2 size={14} />正常
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

            <Card title="RAG 任务分布" className="mt-4">
              <div className="space-y-3">
                <TaskBar
                  label="运行中"
                  count={data?.ragStats?.running ?? 0}
                  total={data?.ragStats?.total ?? 1}
                  color="#3b82f6"
                  icon={<Clock size={12} className="text-blue-500" />}
                />
                <TaskBar
                  label="成功"
                  count={data?.ragStats?.succeeded ?? 0}
                  total={data?.ragStats?.total ?? 1}
                  color="#10b981"
                  icon={<CheckCircle2 size={12} className="text-green-500" />}
                />
                <TaskBar
                  label="失败"
                  count={data?.ragStats?.failed ?? 0}
                  total={data?.ragStats?.total ?? 1}
                  color="#ef4444"
                  icon={<AlertCircle size={12} className="text-red-500" />}
                />
                <TaskBar
                  label="已排队"
                  count={data?.ragStats?.pending ?? 0}
                  total={data?.ragStats?.total ?? 1}
                  color="#f59e0b"
                  icon={<PauseCircle size={12} className="text-amber-500" />}
                />
              </div>
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
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
