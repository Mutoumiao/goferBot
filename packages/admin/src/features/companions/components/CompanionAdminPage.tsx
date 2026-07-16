import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { useAuthStore } from '@/stores/auth'
import { PERMISSIONS } from '@/constants/permissions'
import type {
  AdminCompanion,
  CompanionStatus,
  CreateAdminCompanionPayload,
} from '../services'
import {
  archiveAdminCompanion,
  createAdminCompanion,
  listAdminCompanions,
  updateAdminCompanion,
  updateAdminCompanionStatus,
} from '../services'

const STATUS_COLOR: Record<CompanionStatus, string> = {
  draft: 'default',
  published: 'success',
  archived: 'warning',
}

const STATUS_LABEL: Record<CompanionStatus, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
}

export function CompanionAdminPage() {
  const { message, modal } = App.useApp()
  // super_admin 的 permissions 可能为 ['*']（后端 PermissionRepository），不能只做 code includes
  const hasWrite = useAuthStore((s) => {
    const roles = s.user?.roles ?? []
    if (roles.includes('super_admin')) return true
    return (s.user?.permissions ?? []).includes(PERMISSIONS.COMPANIONS_WRITE)
  })
  const [data, setData] = useState<AdminCompanion[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<CompanionStatus | 'all'>('all')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<AdminCompanion | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<CreateAdminCompanionPayload>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listAdminCompanions({
        status: statusFilter === 'all' ? undefined : statusFilter,
        page: 1,
        size: 50,
      }).send()
      setData(res.items ?? [])
    } catch {
      message.error('加载内置伴侣失败')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, message])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ status: 'draft' })
    setEditorOpen(true)
  }

  const openEdit = (row: AdminCompanion) => {
    setEditing(row)
    form.setFieldsValue({
      name: row.name,
      headline: row.headline ?? undefined,
      description: row.description ?? undefined,
      personality: row.personality ?? undefined,
      tone: row.tone ?? undefined,
      boundaries: row.boundaries ?? undefined,
      guardrailsPrompt: row.guardrailsPrompt ?? undefined,
      backgroundStory: row.backgroundStory ?? undefined,
      openingMessage: row.openingMessage ?? undefined,
      avatarKey: row.avatarKey ?? undefined,
      visibility: row.visibility ?? undefined,
      status: row.status,
    })
    setEditorOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editing) {
        await updateAdminCompanion(editing.id, values).send()
        message.success('已更新')
      } else {
        await createAdminCompanion(values).send()
        message.success('已创建')
      }
      setEditorOpen(false)
      await load()
    } catch {
      /* validate 或网络 */
    } finally {
      setSaving(false)
    }
  }

  const handleStatus = async (row: AdminCompanion, status: CompanionStatus) => {
    try {
      await updateAdminCompanionStatus(row.id, status).send()
      message.success(`已设为${STATUS_LABEL[status]}`)
      await load()
    } catch {
      message.error('状态更新失败')
    }
  }

  const handleArchive = (row: AdminCompanion) => {
    modal.confirm({
      title: '归档内置伴侣',
      content: '归档后 Web 官方列表不可见，会话数据保留。确定？',
      okText: '归档',
      okButtonProps: { danger: true },
      onOk: async () => {
        await archiveAdminCompanion(row.id).send()
        message.success('已归档')
        await load()
      },
    })
  }

  const columns: ColumnsType<AdminCompanion> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, row) => (
        <Space>
          <span>{name}</span>
          {row.headline && <span className="text-gray-400 text-xs">{row.headline}</span>}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: CompanionStatus) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Tag>,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (v: string) => (v ? new Date(v).toLocaleString() : '—'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_, row) =>
        hasWrite ? (
          <Space wrap>
            <Button type="link" size="small" onClick={() => openEdit(row)}>
              编辑
            </Button>
            {row.status !== 'published' && (
              <Button type="link" size="small" onClick={() => void handleStatus(row, 'published')}>
                发布
              </Button>
            )}
            {row.status === 'published' && (
              <Button type="link" size="small" onClick={() => void handleStatus(row, 'draft')}>
                撤回草稿
              </Button>
            )}
            {row.status !== 'archived' && (
              <Button type="link" size="small" danger onClick={() => handleArchive(row)}>
                归档
              </Button>
            )}
          </Space>
        ) : (
          <Button type="link" size="small" onClick={() => openEdit(row)}>
            查看
          </Button>
        ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="内置伴侣"
        extra={
          <Space>
            <Select
              value={statusFilter}
              style={{ width: 120 }}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'draft', label: '草稿' },
                { value: 'published', label: '已发布' },
                { value: 'archived', label: '已归档' },
              ]}
            />
            <Button icon={<RefreshCw size={14} />} onClick={() => void load()}>
              刷新
            </Button>
            {hasWrite && (
              <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
                新建
              </Button>
            )}
          </Space>
        }
      />

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={data}
        pagination={false}
      />

      <Modal
        title={editing ? '编辑内置伴侣' : '新建内置伴侣'}
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onOk={() => void handleSave()}
        confirmLoading={saving}
        width={720}
        destroyOnClose
        okButtonProps={{ disabled: !hasWrite && !!editing }}
      >
        <Form form={form} layout="vertical" disabled={!hasWrite}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="headline" label="一句话设定">
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="description" label="角色说明">
            <Input.TextArea rows={2} maxLength={2000} />
          </Form.Item>
          <Form.Item name="personality" label="性格与互动">
            <Input.TextArea rows={2} maxLength={2000} />
          </Form.Item>
          <Form.Item name="tone" label="语气风格">
            <Input maxLength={500} />
          </Form.Item>
          <Form.Item name="backgroundStory" label="背景故事">
            <Input.TextArea rows={2} maxLength={5000} />
          </Form.Item>
          <Form.Item name="boundaries" label="边界设定">
            <Input.TextArea rows={2} maxLength={2000} />
          </Form.Item>
          <Form.Item name="guardrailsPrompt" label="安全提示词">
            <Input.TextArea rows={2} maxLength={3000} />
          </Form.Item>
          <Form.Item name="openingMessage" label="开场白">
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
          <Form.Item name="avatarKey" label="头像 Key">
            <Input maxLength={500} placeholder="可选，上传后填入" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              options={[
                { value: 'draft', label: '草稿' },
                { value: 'published', label: '已发布' },
                { value: 'archived', label: '已归档' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
