import { Button, Card, Modal, Space, Switch, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Edit, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import type { ModelProvider } from '../services'
import { deleteProviderService, getProviders, saveProviderService } from '../services'
import { ProviderForm } from './ProviderForm'

export function ProviderList() {
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
    Modal.confirm({
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

  const columns: ColumnsType<ModelProvider> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 140 },
    { title: '名称', dataIndex: 'name', key: 'name', width: 160 },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => <Tag>{type}</Tag>,
    },
    { title: '模型', dataIndex: 'model', key: 'model', width: 180 },
    {
      title: 'Base URL',
      dataIndex: 'baseUrl',
      key: 'baseUrl',
      render: (v: string) => <span className="font-mono text-xs text-slate-500">{v}</span>,
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (_: boolean, record) => (
        <Switch
          size="small"
          checked={record.enabled}
          loading={processingId === record.id}
          disabled={processingId !== null && processingId !== record.id}
          onChange={() => void handleToggle(record)}
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<Edit size={14} />}
            disabled={processingId !== null}
            onClick={() => handleOpenEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="text"
            size="small"
            danger
            icon={<Trash2 size={14} />}
            loading={processingId === record.id}
            disabled={processingId !== null && processingId !== record.id}
            onClick={() => void handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

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
              新建 Provider
            </Button>
          </Space>
        }
      />

      <Card>
        <Table<ModelProvider>
          rowKey="id"
          loading={loading}
          dataSource={data}
          columns={columns}
          pagination={false}
          locale={{
            emptyText: (
              <EmptyState
                description="暂无 Provider"
                actionText="新建第一个 Provider"
                onAction={() => handleOpenCreate()}
              />
            ),
          }}
        />
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
