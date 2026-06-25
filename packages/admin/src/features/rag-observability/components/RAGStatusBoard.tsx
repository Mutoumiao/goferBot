import { Card, Col, Row, Tag, Table, Button, Space, Progress, Segmented } from 'antd'
import { Clock, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import type { RagTask } from '../services'
import { fetchRagTasks } from '../services'

export function RAGStatusBoard() {
  const [tasks, setTasks] = useState<RagTask[]>([])
  const [status, setStatus] = useState<'all' | 'pending' | 'running' | 'succeeded' | 'failed'>(
    'all',
  )
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchRagTasks()
      setTasks(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const stats = useMemo(() => {
    return {
      all: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      running: tasks.filter((t) => t.status === 'running').length,
      succeeded: tasks.filter((t) => t.status === 'succeeded').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
    }
  }, [tasks])

  const filtered = status === 'all' ? tasks : tasks.filter((t) => t.status === status)

  return (
    <div className="space-y-4">
      <PageHeader
        title="RAG 观测"
        description="查看 RAG 索引/问答任务的运行状态"
        extra={
          <Button icon={<RefreshCw size={14} />} onClick={() => void load()} loading={loading}>
            刷新
          </Button>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6} md={3}>
          <Card>
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-sm">运行中</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-blue-500">{stats.running}</div>
          </Card>
        </Col>
        <Col xs={12} sm={6} md={3}>
          <Card>
            <div className="flex items-center gap-2 text-slate-500">
              <Clock size={14} />
              <span className="text-sm">排队中</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-500">{stats.pending}</div>
          </Card>
        </Col>
        <Col xs={12} sm={6} md={3}>
          <Card>
            <div className="flex items-center gap-2 text-slate-500">
              <CheckCircle size={14} className="text-green-500" />
              <span className="text-sm">已完成</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-green-500">{stats.succeeded}</div>
          </Card>
        </Col>
        <Col xs={12} sm={6} md={3}>
          <Card>
            <div className="flex items-center gap-2 text-slate-500">
              <AlertCircle size={14} className="text-red-500" />
              <span className="text-sm">失败</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-red-500">{stats.failed}</div>
          </Card>
        </Col>
      </Row>

      <Card
        title="任务列表"
        extra={
          <Segmented
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            options={[
              { label: `全部 (${stats.all})`, value: 'all' },
              { label: `运行中 (${stats.running})`, value: 'running' },
              { label: `排队 (${stats.pending})`, value: 'pending' },
              { label: `成功 (${stats.succeeded})`, value: 'succeeded' },
              { label: `失败 (${stats.failed})`, value: 'failed' },
            ]}
          />
        }
      >
        <Table<RagTask>
          rowKey="id"
          loading={loading}
          dataSource={filtered}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <EmptyState description="暂无任务" /> }}
          columns={[
            { title: '任务 ID', dataIndex: 'id', key: 'id', width: 180 },
            {
              title: '类型',
              dataIndex: 'type',
              key: 'type',
              width: 120,
              render: (t: string) => <Tag>{t}</Tag>,
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              width: 120,
              render: (s: string) => {
                const color =
                  s === 'succeeded'
                    ? 'green'
                    : s === 'failed'
                      ? 'red'
                      : s === 'running'
                        ? 'blue'
                        : 'default'
                return <Tag color={color}>{s}</Tag>
              },
            },
            {
              title: '进度',
              dataIndex: 'progress',
              key: 'progress',
              width: 160,
              render: (v: number) => <Progress percent={v} size="small" showInfo={false} />,
            },
            {
              title: '耗时',
              dataIndex: 'durationMs',
              key: 'durationMs',
              width: 100,
              render: (v: number) => `${(v / 1000).toFixed(1)}s`,
            },
            {
              title: '错误',
              dataIndex: 'error',
              key: 'error',
              render: (v?: string) => (v ? <span className="text-red-500 text-xs">{v}</span> : '—'),
            },
            {
              title: '创建时间',
              dataIndex: 'createdAt',
              key: 'createdAt',
              width: 180,
              render: (v: string) => new Date(v).toLocaleString('zh-CN'),
            },
          ]}
        />
      </Card>
    </div>
  )
}
