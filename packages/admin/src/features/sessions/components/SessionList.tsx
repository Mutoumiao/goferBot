import { useNavigate } from '@tanstack/react-router'
import { Button, Card, DatePicker, Select, Space, Table, Tag } from 'antd'
import { Eye, RefreshCw, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import type { ListSessionsQuery, SessionItem } from '../services'
import { fetchSessions } from '../services'

export function SessionList() {
  const navigate = useNavigate()
  const [data, setData] = useState<SessionItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState<ListSessionsQuery>({ page: 1, pageSize: 10 })
  const [filters, setFilters] = useState<{ model?: string; status?: string }>({})

  const load = useCallback(async (q: ListSessionsQuery) => {
    setLoading(true)
    try {
      const result = await fetchSessions(q)
      setData(result.items)
      setTotal(result.total)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = () => {
    void load({ ...query, page: 1, ...filters })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="会话观测"
        description="查看用户会话与对话详情"
        extra={
          <Button icon={<RefreshCw size={14} />} onClick={() => void load(query)}>
            刷新
          </Button>
        }
      />

      <Card>
        <Space wrap size="middle" className="mb-4">
          <Select
            placeholder="模型"
            allowClear
            value={filters.model}
            onChange={(v) => setFilters((f) => ({ ...f, model: v }))}
            style={{ width: 160 }}
            options={[
              { value: 'deepseek', label: 'DeepSeek' },
              { value: 'gpt-4o', label: 'GPT-4o' },
              { value: 'glm-4', label: 'GLM-4' },
            ]}
          />
          <Select
            placeholder="状态"
            allowClear
            value={filters.status}
            onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            style={{ width: 140 }}
            options={[
              { value: 'active', label: '进行中' },
              { value: 'archived', label: '已归档' },
              { value: 'stopped', label: '已停止' },
            ]}
          />
          <DatePicker.RangePicker
            showTime
            placeholder={['开始时间', '结束时间']}
            onChange={(dates) => {
              const [s, e] = dates ?? []
              setFilters((f) => ({
                ...f,
                startDate: s?.toISOString(),
                endDate: e?.toISOString(),
              }))
            }}
          />
          <Button type="primary" icon={<Search size={14} />} onClick={handleSearch}>
            搜索
          </Button>
        </Space>

        <Table<SessionItem>
          rowKey="id"
          loading={loading}
          dataSource={data}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total,
            onChange: (page, pageSize) => {
              const q = { ...query, page, pageSize }
              setQuery(q)
              void load(q)
            },
          }}
          locale={{ emptyText: <EmptyState description="暂无会话" /> }}
          columns={[
            {
              title: '会话标题',
              dataIndex: 'title',
              key: 'title',
              render: (v: string) => <span className="font-medium">{v}</span>,
            },
            { title: '用户', dataIndex: 'userEmail', key: 'userEmail', width: 180 },
            {
              title: '模型',
              dataIndex: 'model',
              key: 'model',
              width: 120,
              render: (v: string) => <Tag>{v}</Tag>,
            },
            { title: '消息数', dataIndex: 'messageCount', key: 'messageCount', width: 100 },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              width: 120,
              render: (s: string) => {
                const color = s === 'active' ? 'green' : s === 'archived' ? 'default' : 'red'
                return (
                  <Tag color={color}>
                    {s === 'active' ? '进行中' : s === 'archived' ? '已归档' : '已停止'}
                  </Tag>
                )
              },
            },
            {
              title: '最近更新',
              dataIndex: 'updatedAt',
              key: 'updatedAt',
              width: 180,
              render: (v: string) => new Date(v).toLocaleString('zh-CN'),
            },
            {
              title: '操作',
              key: 'actions',
              width: 100,
              render: (_: unknown, record) => (
                <Button
                  type="link"
                  size="small"
                  icon={<Eye size={14} />}
                  onClick={() => navigate({ to: `/sessions/${record.id}` })}
                >
                  查看
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
