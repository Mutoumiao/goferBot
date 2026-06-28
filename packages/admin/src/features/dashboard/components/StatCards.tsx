import { Card, Col, Row, Statistic } from 'antd'
import { FileText, MessageSquare, TrendingUp, Users, Workflow } from 'lucide-react'
import type { DashboardData } from '../services'

export interface StatCardsProps {
  stats?: DashboardData['stats']
}

export function StatCards({ stats }: StatCardsProps) {
  const formatNumber = (n: number) => {
    if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
    return n.toLocaleString()
  }

  return (
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
  )
}
