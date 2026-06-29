import { Alert, Button, Col, Row } from 'antd'
import { RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import type { DashboardData } from '../services'
import { OverviewChart } from './OverviewChart'
import { RecentActivities } from './RecentActivities'
import { StatCards } from './StatCards'
import { SystemHealth } from './SystemHealth'

export interface DashboardViewProps {
  data?: DashboardData
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
}

export function DashboardView({ data, loading, error, onRefresh }: DashboardViewProps) {
  return (
    <div className="space-y-4">
      <PageHeader
        title="控制台"
        description="查看系统整体运行状态与核心指标"
        extra={
          <Button icon={<RefreshCw size={14} />} onClick={onRefresh} loading={loading}>
            刷新
          </Button>
        }
      />

      {error && !data && (
        <Alert
          type="error"
          showIcon
          message={error}
          action={
            <Button size="small" type="primary" onClick={onRefresh}>
              重试
            </Button>
          }
        />
      )}

      <div aria-busy={loading} style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 200ms' }}>
        <StatCards stats={data?.stats} />

        <Row gutter={[16, 16]} className="mt-2">
          <Col xs={24} lg={14}>
            <RecentActivities activities={data?.activities ?? []} />
          </Col>

          <Col xs={24} lg={10}>
            <SystemHealth health={data?.health} />
            <div className="mt-4">
              <OverviewChart ragStats={data?.ragStats} />
            </div>
          </Col>
        </Row>
      </div>
    </div>
  )
}
