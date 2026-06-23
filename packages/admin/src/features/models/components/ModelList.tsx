import { Card, Table, Tag, Button, Space, Modal, App } from 'antd'
import { RefreshCw, Play, Key, Trash2, Edit } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import type { ModelConfig } from '../services'
import {
  deleteModelService,
  getModels,
  testModelConnection,
  updateModelService,
} from '../services'
import { confirmPasswordAction } from '@/utils/confirm-action'
import { ModelConfigForm } from './ModelConfigForm'

export function ModelList() {
  const { message } = App.useApp()
  const [data, setData] = useState<ModelConfig[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const models = await getModels()
      setData(models)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleTest = async (model: ModelConfig) => {
    await testModelConnection(model.id)
  }

  const handleToggleActive = async (model: ModelConfig) => {
    const result = await updateModelService(model.id, { isActive: !model.isActive })
    if (result.success) {
      void load()
    }
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
    const deleteResult = await deleteModelService(model.id)
    if (deleteResult.success) {
      void load()
    }
  }

  const handleCreate = async () => {
    const result = await ModelConfigForm()
    if (result) {
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
            <Button type="primary" icon={<Edit size={14} />} onClick={() => void handleCreate()}>
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
