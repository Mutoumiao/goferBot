import { Card, Table, Tag, Space, Button, Select, DatePicker } from 'antd'
import { Download, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import type { AuditLog, AuditQuery } from '../services'
import { exportAuditLogs, fetchAuditLogs } from '../services'

export function AuditLogTable() {
  const [data, setData] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState<AuditQuery>({ page: 1, pageSize: 20 })
  const [filters, setFilters] = useState<{ action?: string; sensitiveOnly?: boolean }>({})

  const load = useCallback(async (q: AuditQuery) => {
    setLoading(true)
    try {
      const result = await fetchAuditLogs(q)
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

  const handleExport = async () => {
    const blob = await exportAuditLogs({ ...query, ...filters })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="审计日志"
        description="查看管理员关键操作记录"
        extra={
          <Space>
            <Button icon={<RefreshCw size={14} />} onClick={() => void load(query)}>
              刷新
            </Button>
            <Button icon={<Download size={14} />} onClick={() => void handleExport()}>
              导出 CSV
            </Button>
          </Space>
        }
      />

      <Card>
        <Space wrap size="middle" className="mb-4">
          <Select
            placeholder="操作类型"
            allowClear
            value={filters.action}
            onChange={(v) => setFilters((f) => ({ ...f, action: v }))}
            style={{ width: 180 }}
            options={[
              { value: 'LOGIN', label: '登录' },
              { value: 'LOGOUT', label: '登出' },
              { value: 'USER_CREATE', label: '创建用户' },
              { value: 'USER_DELETE', label: '删除用户' },
              { value: 'USER_UPDATE', label: '修改用户' },
              { value: 'ROLE_CREATE', label: '创建角色' },
              { value: 'ROLE_DELETE', label: '删除角色' },
              { value: 'ROLE_UPDATE', label: '修改角色' },
              { value: 'MODEL_CREATE', label: '创建模型' },
              { value: 'MODEL_DELETE', label: '删除模型' },
              { value: 'API_KEY_REVEAL', label: '查看 API Key' },
            ]}
          />
          <Select
            placeholder="仅敏感操作"
            allowClear
            value={filters.sensitiveOnly ? 'yes' : undefined}
            onChange={(v) => setFilters((f) => ({ ...f, sensitiveOnly: v === 'yes' }))}
            style={{ width: 140 }}
            options={[{ value: 'yes', label: '仅敏感操作' }]}
          />
          <DatePicker.RangePicker
            showTime
            onChange={(dates) => {
              const [s, e] = dates ?? []
              setFilters((f) => ({
                ...f,
                startDate: s?.toISOString(),
                endDate: e?.toISOString(),
              }))
            }}
          />
          <Button type="primary" onClick={handleSearch}>
            搜索
          </Button>
        </Space>

        <Table<AuditLog>
          rowKey="id"
          loading={loading}
          dataSource={data}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100'],
            onChange: (page, pageSize) => {
              const q = { ...query, page, pageSize }
              setQuery(q)
              void load(q)
            },
          }}
          columns={[
            { title: '操作人', dataIndex: 'actorName', key: 'actorName', width: 180 },
            {
              title: '操作',
              dataIndex: 'action',
              key: 'action',
              width: 160,
              render: (v: string, r) => (
                <div className="flex items-center gap-2">
                  <Tag color={r.sensitive ? 'red' : 'blue'}>{v}</Tag>
                  {r.sensitive && <Tag color="red">敏感</Tag>}
                </div>
              ),
            },
            { title: '资源', dataIndex: 'resource', key: 'resource', width: 120 },
            {
              title: '资源 ID',
              dataIndex: 'resourceId',
              key: 'resourceId',
              width: 160,
              render: (v?: string) => v ?? '—',
            },
            {
              title: 'IP',
              dataIndex: 'ip',
              key: 'ip',
              width: 140,
              render: (v?: string) => v ?? '—',
            },
            {
              title: '时间',
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
