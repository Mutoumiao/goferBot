import { Button, Card, Table, Tag, Space, Popconfirm } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, RefreshCw, Edit, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import type { Role } from '@/api/role'
import { deleteRoleService, fetchRoles } from '../services'
import { RoleFormModal } from './RoleForm'
import { confirmPasswordAction } from '@/utils/confirm-action'

export function RoleList() {
  const navigate = useNavigate()
  const [data, setData] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const roles = await fetchRoles()
      setData(roles)
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async () => {
    const success = await RoleFormModal()
    if (success) void load()
  }

  const handleEdit = async (role: Role) => {
    const success = await RoleFormModal({ roleId: role.id })
    if (success) void load()
  }

  const handleDelete = async (role: Role) => {
    if (role.isBuiltIn) return
    const result = await confirmPasswordAction(
      '删除角色',
      <>
        确定要删除角色 <b>{role.name}</b> 吗？已绑定该角色的用户将降级为普通用户。
      </>,
    )
    if (!result.confirmed) return
    await deleteRoleService(role.id)
    void load()
  }

  const columns: ColumnsType<Role> = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-700">{name}</span>
          {record.isBuiltIn && <Tag color="blue">内置</Tag>}
        </div>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (v?: string) => <span className="text-slate-500">{v ?? '—'}</span>,
    },
    {
      title: '权限数',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (perms: string[]) => <Tag color="purple">{perms.length} 项</Tag>,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (v: string) => <span className="text-slate-500">{new Date(v).toLocaleString('zh-CN')}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<Edit size={14} />}
            onClick={() => void handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title={record.isBuiltIn ? '内置角色不可删除' : '确定删除此角色？'}
            disabled={record.isBuiltIn}
            onConfirm={() => void handleDelete(record)}
            okText="删除"
            okButtonProps={{ danger: true, disabled: record.isBuiltIn }}
            cancelText="取消"
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<Trash2 size={14} />}
              disabled={record.isBuiltIn}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="权限管理"
        description="管理系统角色与权限分配"
        extra={
          <Space>
            <Button icon={<RefreshCw size={14} />} onClick={() => void load()}>
              刷新
            </Button>
            <Button type="primary" icon={<Plus size={14} />} onClick={() => void handleCreate()}>
              新建角色
            </Button>
          </Space>
        }
      />

      <Card>
        <Table<Role>
          rowKey="id"
          loading={loading}
          dataSource={data}
          columns={columns}
          pagination={false}
          locale={{ emptyText: <EmptyState description="暂无角色" actionText="新建第一个角色" onAction={handleCreate} /> }}
        />
      </Card>
    </div>
  )
}
