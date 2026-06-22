import { Col, Row, Spin } from 'antd'
import { StatCards } from './StatCards'
import { RecentActivities } from './RecentActivities'
import { SystemHealth } from './SystemHealth'
import { OverviewChart } from './OverviewChart'
import { PageHeader } from '@/components/common/PageHeader'
import type { DashboardData } from '../services'

export interface DashboardViewProps {
  data?: DashboardData
  loading?: boolean
  onRefresh?: () => void
}

export function DashboardView({ data, loading, onRefresh }: DashboardViewProps) {
  return (
    <div className="space-y-4">
      <PageHeader
        title="控制台"
        description="查看系统整体运行状态与核心指标"
        extra={<button onClick={onRefresh}>刷新</button>}
      />

      <Spin spinning={loading}>
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
      </Spin>
    </div>
  )
}
