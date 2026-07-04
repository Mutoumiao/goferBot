import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Copy, Plus, RefreshCw, Trash2, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import type { CreateInvitationRequest, InvitationCode, InvitationQuery } from '../services'
import {
  createInvitationService,
  deleteInvitationService,
  fetchInvitations,
  revokeInvitationService,
} from '../services'

type InvitationTypeFilter = 'all' | 'standard' | 'multi'
type InvitationStatusFilter = 'all' | 'active' | 'used_up' | 'revoked' | 'expired'

interface CreateFormValues {
  type: 'standard' | 'multi'
  maxUses?: number
  note?: string
  expiresAt?: { toISOString: () => string }
}

function padZero(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function formatDateTime(isoStr: string | null): string {
  if (!isoStr) return '永不过期'
  const d = new Date(isoStr)
  const y = d.getFullYear()
  const m = padZero(d.getMonth() + 1)
  const day = padZero(d.getDate())
  const h = padZero(d.getHours())
  const min = padZero(d.getMinutes())
  return `${y}-${m}-${day} ${h}:${min}`
}

function getInvitationStatus(record: InvitationCode): {
  label: string
  color: 'green' | 'default' | 'red' | 'orange'
} {
  if (record.isRevoked) {
    return { label: '已撤销', color: 'red' }
  }
  if (record.isExpired) {
    return { label: '已过期', color: 'orange' }
  }
  if (record.maxUses !== null && record.useCount >= record.maxUses) {
    return { label: '已用完', color: 'default' }
  }
  return { label: '可用', color: 'green' }
}

function formatUseCount(useCount: number, maxUses: number | null): string {
  if (maxUses === null) {
    return `${useCount} / ∞`
  }
  return `${useCount} / ${maxUses}`
}

export function InvitationCodeTable() {
  const [data, setData] = useState<InvitationCode[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState<InvitationQuery>({ page: 1, pageSize: 10 })
  const [typeFilter, setTypeFilter] = useState<InvitationTypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<InvitationStatusFilter>('all')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm] = Form.useForm<CreateFormValues>()
  const [createLoading, setCreateLoading] = useState(false)

  const load = useCallback(async (q: InvitationQuery) => {
    setLoading(true)
    try {
      const result = await fetchInvitations(q)
      setData(result.items)
      setTotal(result.total)
      setQuery(q)
    } catch {
      //
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const buildApiQuery = (
    page: number,
    pageSize: number,
    type: InvitationTypeFilter,
    status: InvitationStatusFilter,
  ): InvitationQuery => {
    const q: InvitationQuery = { page, pageSize }
    if (type !== 'all') {
      q.type = type
    }
    if (status === 'active') {
      q.active = true
    }
    return q
  }

  const handleSearch = () => {
    void load(buildApiQuery(1, query.pageSize ?? 10, typeFilter, statusFilter))
  }

  const handleReset = () => {
    setTypeFilter('all')
    setStatusFilter('all')
    void load({ page: 1, pageSize: query.pageSize ?? 10 })
  }

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      message.success('邀请码已复制到剪贴板')
    } catch {
      message.error('复制失败，请手动复制')
    }
  }

  const handleRevoke = async (record: InvitationCode) => {
    await revokeInvitationService(record.id)
    void load(query)
  }

  const handleDelete = async (record: InvitationCode) => {
    await deleteInvitationService(record.id)
    void load(query)
  }

  const openCreateModal = () => {
    createForm.resetFields()
    createForm.setFieldsValue({ type: 'standard' })
    setCreateModalOpen(true)
  }

  const handleCreateSubmit = async () => {
    try {
      const values = await createForm.validateFields()
      setCreateLoading(true)
      const payload: CreateInvitationRequest = {
        type: values.type,
        maxUses: values.maxUses,
        note: values.note,
        expiresAt: values.expiresAt ? values.expiresAt.toISOString() : undefined,
      }
      const res = await createInvitationService(payload)
      if (res.success) {
        setCreateModalOpen(false)
        void load(query)
      }
    } catch {
      // form validation error
    } finally {
      setCreateLoading(false)
    }
  }

  const columns: ColumnsType<InvitationCode> = [
    {
      title: '邀请码',
      dataIndex: 'code',
      key: 'code',
      width: 180,
      render: (v: string) => (
        <code className="rounded bg-slate-100 px-2 py-1 font-mono text-sm">{v}</code>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (v: 'standard' | 'multi') =>
        v === 'standard' ? <Tag color="blue">标准码</Tag> : <Tag color="purple">多次码</Tag>,
    },
    {
      title: '使用次数',
      key: 'usage',
      width: 120,
      render: (_: unknown, record) => formatUseCount(record.useCount, record.maxUses),
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: '过期时间',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      width: 160,
      render: (v: string | null) => formatDateTime(v),
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_: unknown, record) => {
        const s = getInvitationStatus(record)
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => formatDateTime(v),
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      render: (_: unknown, record) => {
        const status = getInvitationStatus(record)
        const canRevoke = status.color === 'green'
        return (
          <Space size="small">
            <Button
              type="text"
              size="small"
              icon={<Copy size={14} />}
              onClick={() => void handleCopy(record.code)}
            >
              复制
            </Button>
            <Popconfirm
              title="确定撤销此邀请码？"
              description="撤销后该邀请码将无法使用"
              onConfirm={() => void handleRevoke(record)}
              okText="撤销"
              okButtonProps={{ danger: true }}
              cancelText="取消"
              disabled={!canRevoke}
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<XCircle size={14} />}
                disabled={!canRevoke}
              >
                撤销
              </Button>
            </Popconfirm>
            <Popconfirm
              title="确定删除此邀请码？"
              description="删除后无法恢复"
              onConfirm={() => void handleDelete(record)}
              okText="删除"
              okButtonProps={{ danger: true }}
              cancelText="取消"
            >
              <Button type="text" size="small" danger icon={<Trash2 size={14} />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title="邀请码管理"
        description="管理注册邀请码"
        extra={
          <Space>
            <Button icon={<RefreshCw size={14} />} onClick={() => void load(query)}>
              刷新
            </Button>
            <Button type="primary" icon={<Plus size={14} />} onClick={openCreateModal}>
              创建邀请码
            </Button>
          </Space>
        }
      />

      <Card>
        <Space wrap size="middle" className="mb-4">
          <Select
            placeholder="类型"
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '全部类型' },
              { value: 'standard', label: '标准码' },
              { value: 'multi', label: '多次码' },
            ]}
          />
          <Select
            placeholder="状态"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'active', label: '可用' },
              { value: 'used_up', label: '已用完' },
              { value: 'revoked', label: '已撤销' },
              { value: 'expired', label: '已过期' },
            ]}
          />
          <Button type="primary" onClick={handleSearch}>
            搜索
          </Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>

        <Table<InvitationCode>
          rowKey="id"
          loading={loading}
          dataSource={data}
          columns={columns}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (page, pageSize) => {
              void load(buildApiQuery(page, pageSize, typeFilter, statusFilter))
            },
          }}
          scroll={{ x: 1100 }}
        />
      </Card>

      <Modal
        title="创建邀请码"
        open={createModalOpen}
        onOk={() => void handleCreateSubmit()}
        onCancel={() => setCreateModalOpen(false)}
        okText="创建"
        cancelText="取消"
        confirmLoading={createLoading}
        width={480}
      >
        <Form form={createForm} layout="vertical" preserve={false} className="pt-2">
          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true, message: '请选择邀请码类型' }]}
            initialValue="standard"
          >
            <Select
              options={[
                { value: 'standard', label: '标准码（单次使用）' },
                { value: 'multi', label: '多次码（可重复使用）' },
              ]}
            />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
            {({ getFieldValue }) =>
              getFieldValue('type') === 'multi' ? (
                <Form.Item name="maxUses" label="最大使用次数" tooltip="不填则表示无限次使用">
                  <InputNumber min={1} placeholder="不填则无限次" style={{ width: '100%' }} />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Form.Item name="note" label="备注">
            <Input.TextArea placeholder="选填，例如：发给合作伙伴" rows={2} />
          </Form.Item>

          <Form.Item name="expiresAt" label="过期时间" tooltip="不选则永不过期">
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              placeholder="选择过期时间（不选则永不过期）"
              style={{ width: '100%' }}
              disabledDate={(current) => {
                if (!current) return false
                const d = new Date(current.valueOf())
                d.setHours(0, 0, 0, 0)
                return d < today
              }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
