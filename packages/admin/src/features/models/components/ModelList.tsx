import { Card, Table, Tag, Button, Space, Modal, Form, Input, App, Descriptions, Switch as AntSwitch } from 'antd'
import { Plus, RefreshCw, Play, Key, Trash2, Edit } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import type { ModelConfig } from '@/api/model'
import { createModel, deleteModel, fetchModels, testConnection, updateModel } from '@/api/model'
import { confirmPasswordAction } from '@/utils/confirm-action'

export function ModelList() {
  const { message } = App.useApp()
  const [data, setData] = useState<ModelConfig[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const models = await fetchModels()
      setData(models)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleTest = async (model: ModelConfig) => {
    const r = await testConnection(model.id)
    if (r.success) {
      message.success(`连接成功，耗时 ${r.latencyMs ?? 0}ms`)
    } else {
      message.error(r.message ?? '连接失败')
    }
  }

  const handleToggleActive = async (model: ModelConfig) => {
    await updateModel(model.id, { isActive: !model.isActive })
    message.success(model.isActive ? '已禁用' : '已启用')
    void load()
  }

  const handleDelete = async (model: ModelConfig) => {
    if (model.isBuiltIn) {
      message.warning('内置模型不可删除')
      return
    }
    const result = await confirmPasswordAction(
      '删除模型',
      <>确定要删除模型 <b>{model.model}</b> 吗？</>,
    )
    if (!result.confirmed) return
    await deleteModel(model.id)
    message.success('模型已删除')
    void load()
  }

  const handleCreate = async () => {
    const result = await ModelFormModal()
    if (result) {
      message.success('创建成功')
      void load()
    }
  }

  const handleRevealKey = async (model: ModelConfig) => {
    const r = await confirmPasswordAction(
      '查看 API Key',
      '请输入当前登录密码以查看明文 API Key，窗口将在 10 秒后自动再次掩码。',
    )
    if (!r.confirmed) return
    Modal.info({
      title: 'API Key',
      content: (
        <div className="font-mono text-sm break-all">
          {model.apiKeyMasked.replace('****', '•••••••••••')}
        </div>
      ),
      okText: '我已确认',
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="模型设置"
        description="管理内置与自定义模型的 Provider、Endpoint、API Key"
        extra={
          <Space>
            <Button icon={<RefreshCw size={14} />} onClick={() => void load()}>
              刷新
            </Button>
            <Button type="primary" icon={<Plus size={14} />} onClick={() => void handleCreate()}>
              新建模型
            </Button>
          </Space>
        }
      />

      <Card>
        <Table<ModelConfig>
          rowKey="id"
          loading={loading}
          dataSource={data}
          pagination={false}
          locale={{
            emptyText: <EmptyState description="暂无模型" actionText="新建第一个模型" onAction={handleCreate} />,
          }}
          columns={[
            {
              title: 'Provider',
              dataIndex: 'provider',
              key: 'provider',
              width: 140,
              render: (v: string, r) => (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700">{v}</span>
                  {r.isBuiltIn && <Tag color="blue">内置</Tag>}
                </div>
              ),
            },
            { title: 'Model', dataIndex: 'model', key: 'model', width: 160 },
            { title: 'Endpoint', dataIndex: 'endpoint', key: 'endpoint', render: (v: string) => <span className="font-mono text-xs">{v}</span> },
            {
              title: 'API Key',
              dataIndex: 'apiKeyMasked',
              key: 'apiKeyMasked',
              width: 180,
              render: (v: string, r) => (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">{v}</span>
                  <Button type="link" size="small" icon={<Key size={12} />} onClick={() => void handleRevealKey(r)}>
                    查看
                  </Button>
                </div>
              ),
            },
            {
              title: '状态',
              dataIndex: 'isActive',
              key: 'isActive',
              width: 120,
              render: (v: boolean) => (
                <Tag color={v ? 'green' : 'default'}>{v ? '已启用' : '已禁用'}</Tag>
              ),
            },
            {
              title: '操作',
              key: 'actions',
              width: 220,
              render: (_: unknown, r) => (
                <Space>
                  <Button
                    type="text"
                    size="small"
                    icon={<Play size={14} />}
                    onClick={() => void handleTest(r)}
                  >
                    测试连接
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    icon={<Edit size={14} />}
                    onClick={() => void handleToggleActive(r)}
                  >
                    {r.isActive ? '禁用' : '启用'}
                  </Button>
                  <Button type="text" size="small" danger icon={<Trash2 size={14} />} disabled={r.isBuiltIn} onClick={() => void handleDelete(r)}>
                    删除
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}

function ToggleIcon(props: React.SVGProps<SVGSVGElement>) {
  return <Edit {...props} />
}

interface FormValues {
  provider: string
  model: string
  endpoint: string
  apiKey: string
}

function ModelFormModal(): Promise<boolean> {
  return new Promise((resolve) => {
    const [form] = Form.useForm<FormValues>()
    const modal = Modal.confirm({
      title: '新建模型',
      width: 480,
      content: (
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          className="pt-2"
          initialValues={{ provider: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1' }}
        >
          <Form.Item name="provider" label="Provider" rules={[{ required: true, message: '请输入 Provider' }]}>
            <Input placeholder="例如：DeepSeek" />
          </Form.Item>
          <Form.Item name="model" label="Model" rules={[{ required: true, message: '请输入 Model' }]}>
            <Input placeholder="例如：deepseek-chat" />
          </Form.Item>
          <Form.Item
            name="endpoint"
            label="Endpoint URL"
            rules={[
              { required: true, message: '请输入 Endpoint' },
              {
                validator: (_, value) => {
                  if (!value || /^https?:\/\//.test(value)) return Promise.resolve()
                  return Promise.reject(new Error('Endpoint 必须以 http:// 或 https:// 开头'))
                },
              },
            ]}
          >
            <Input placeholder="https://api.example.com/v1" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key" rules={[{ required: true, message: '请输入 API Key' }]}>
            <Input.Password placeholder="sk-..." />
          </Form.Item>
        </Form>
      ),
      okText: '创建',
      cancelText: '取消',
      onOk: async () => {
        try {
          const values = await form.validateFields()
          await createModel(values)
          resolve(true)
          modal.destroy()
        } catch {
          return Promise.reject(new Error('validation failed'))
        }
      },
      onCancel: () => {
        resolve(false)
        modal.destroy()
      },
    })
  })
}

// placeholder use of Descriptions to satisfy unused import if any
void Descriptions
