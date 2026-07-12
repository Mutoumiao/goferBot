import { App, Button, Card, Collapse, Space, Switch, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Edit, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import type { Model, ModelProvider } from '../services'
import { deleteProviderService, getProviders, saveProviderService } from '../services'
import { ProviderForm } from './ProviderForm'

const TYPE_LABELS: Record<string, string> = {
  llm: 'LLM',
  embedding: 'Embedding',
  reranker: 'Reranker',
  'document-parser': 'Document Parser',
}

export function ProviderList() {
  const { modal } = App.useApp()
  const [data, setData] = useState<ModelProvider[]>([])
  const [loading, setLoading] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<ModelProvider | undefined>(undefined)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const record = await getProviders()
      setData(Object.values(record))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleToggle = async (provider: ModelProvider) => {
    if (processingId) return
    setProcessingId(provider.id)
    try {
      const updated = { ...provider, enabled: !provider.enabled }
      const ok = await saveProviderService(updated)
      if (ok) void load()
    } finally {
      setProcessingId(null)
    }
  }

  const handleDelete = async (provider: ModelProvider) => {
    if (processingId) return
    modal.confirm({
      title: '删除 Provider',
      content: (
        <span>
          确定要删除 <b>{provider.name}</b> 吗？该操作不可撤销。
        </span>
      ),
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setProcessingId(provider.id)
        try {
          const ok = await deleteProviderService(provider.id)
          if (ok) void load()
        } finally {
          setProcessingId(null)
        }
      },
    })
  }

  const handleOpenCreate = () => {
    setEditingProvider(undefined)
    setModalOpen(true)
  }

  const handleOpenEdit = (provider: ModelProvider) => {
    setEditingProvider(provider)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingProvider(undefined)
  }

  const handleSaveSuccess = () => {
    setModalOpen(false)
    setEditingProvider(undefined)
    void load()
  }

  const modelColumns: ColumnsType<Model> = [
    { title: '模型名称', dataIndex: 'name', key: 'name' },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => <Tag>{TYPE_LABELS[type] ?? type}</Tag>,
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean) => <Switch size="small" checked={enabled} disabled />,
    },
    {
      title: '额外参数',
      key: 'extra',
      width: 160,
      render: (_: unknown, record: Model) => {
        const parts: string[] = []
        if (record.dimensions !== undefined) parts.push(`dim=${record.dimensions}`)
        if (record.maxLength !== undefined) parts.push(`maxLen=${record.maxLength}`)
        return parts.length > 0 ? (
          <span className="font-mono text-xs text-text-tertiary">{parts.join(', ')}</span>
        ) : (
          <span className="text-xs text-text-quaternary">-</span>
        )
      },
    },
  ]

  const collapseItems = data.map((provider) => ({
    key: provider.id,
    label: (
      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <span className="font-medium text-text-primary">{provider.name}</span>
        <Space size={4}>
          {Array.from(new Set(provider.models.map((m) => m.type))).map((type) => (
            <Tag key={type}>{TYPE_LABELS[type] ?? type}</Tag>
          ))}
        </Space>
        <span className="text-xs text-text-tertiary">{provider.models.length} 个模型</span>
      </div>
    ),
    children: (
      <div className="space-y-3">
        <Table<Model>
          rowKey={(record) => `${provider.id}#${record.name}`}
          dataSource={provider.models}
          columns={modelColumns}
          pagination={false}
          size="small"
        />
        <div className="flex items-center justify-between">
          <div className="space-y-1 text-xs text-text-secondary">
            <div>
              <span className="text-text-tertiary">Base URL: </span>
              <span className="font-mono">{provider.baseUrl || '(空)'}</span>
              {provider.isCompleteUrl && (
                <Tag color="blue" className="ml-2">
                  完整 URL
                </Tag>
              )}
            </div>
            <div>
              <span className="text-text-tertiary">API Key: </span>
              <span className="font-mono">{provider.apiKey || '(空)'}</span>
            </div>
          </div>
          <Space>
            <Button
              type="text"
              size="small"
              icon={<Edit size={14} />}
              disabled={processingId !== null}
              onClick={() => handleOpenEdit(provider)}
            >
              编辑
            </Button>
            <Button
              type="text"
              size="small"
              danger
              icon={<Trash2 size={14} />}
              loading={processingId === provider.id}
              disabled={processingId !== null && processingId !== provider.id}
              onClick={() => void handleDelete(provider)}
            >
              删除
            </Button>
          </Space>
        </div>
      </div>
    ),
    extra: (
      <div onClick={(e) => e.stopPropagation()}>
        <Switch
          size="small"
          checked={provider.enabled}
          loading={processingId === provider.id}
          disabled={processingId !== null && processingId !== provider.id}
          onChange={() => void handleToggle(provider)}
        />
      </div>
    ),
  }))

  return (
    <div className="space-y-4">
      <PageHeader
        title="模型提供商"
        description="管理 LLM、Embedding、Reranker 等模型提供商配置"
        extra={
          <Space>
            <Button icon={<RefreshCw size={14} />} onClick={() => void load()} disabled={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<Plus size={14} />} onClick={() => handleOpenCreate()}>
              新建提供商
            </Button>
          </Space>
        }
      />

      <Card loading={loading}>
        {data.length === 0 && !loading ? (
          <EmptyState
            description="暂无 Provider"
            actionText="新建提供商"
            onAction={() => handleOpenCreate()}
          />
        ) : (
          <Collapse items={collapseItems} />
        )}
      </Card>

      <ProviderForm
        open={modalOpen}
        provider={editingProvider}
        onCancel={handleCloseModal}
        onSuccess={handleSaveSuccess}
      />
    </div>
  )
}
