import { Avatar, Button, Card, Input, Select, Space, Switch, Table, Tag, Popconfirm, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, RefreshCw, Search, Edit, Trash2, KeyRound, UserCog, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { StatusTag } from '@/components/common/StatusTag'
import type { AdminUserResponse, ListUsersQuery } from '../services'
import { assignUserRole, deleteUserService, fetchUsers, toggleUserStatus } from '../services'
import { createUserModal } from './UserCreateForm'
import { resetPasswordModal } from './ResetPasswordDialog'
import { assignRoleModal } from './RoleAssignDialog'
import { confirmPasswordAction } from '@/utils/confirm-action'

export interface UserTableProps {
  initialQuery?: ListUsersQuery
}

export function UserTable({ initialQuery }: UserTableProps) {
  const navigate = useNavigate()
  const [data, setData] = useState<AdminUserResponse[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [query, setQuery] = useState<ListUsersQuery>({
    page: 1,
    pageSize: 10,
    ...initialQuery,
  })
  const [searchInput, setSearchInput] = useState(initialQuery?.search ?? '')
  const [roleFilter, setRoleFilter] = useState<'all' | 'ADMIN' | 'USER'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all')

  const load = useCallback(async (q: ListUsersQuery) => {
    setLoading(true)
    try {
      const result = await fetchUsers(q)
      setData(result.items)
      setTotal(result.total)
      setQuery(q)
    } catch {
      // 保留当前数据
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = () => {
    const q: ListUsersQuery = {
      ...query,
      page: 1,
      search: searchInput.trim() || undefined,
      role: roleFilter === 'all' ? undefined : roleFilter,
      isActive:
        statusFilter === 'all' ? undefined : statusFilter === 'active' ? true : false,
    }
    void load(q)
  }

  const handleReset = () => {
    setSearchInput('')
    setRoleFilter('all')
    setStatusFilter('all')
    const q: ListUsersQuery = { page: 1, pageSize: query.pageSize ?? 10 }
    void load(q)
  }

  const handleToggleStatus = async (user: AdminUserResponse) => {
    await toggleUserStatus(user.id, user.isActive)
    void load(query)
  }

  const handleDelete = async (user: AdminUserResponse) => {
    const result = await confirmPasswordAction(
      '删除用户',
      <>
        确定要删除用户 <b>{user.email}</b> 吗？该操作不可撤销。
      </>,
    )
    if (!result.confirmed) return
    await deleteUserService(user.id)
    void load(query)
  }

  const handleCreate = async () => {
    const success = await createUserModal()
    if (success) void load(query)
  }

  const handleResetPassword = async (user: AdminUserResponse) => {
    const success = await resetPasswordModal(user)
    if (success) message.success('密码已重置')
  }

  const handleAssignRole = async (user: AdminUserResponse) => {
    const role = await assignRoleModal(user)
    if (role) {
      await assignUserRole(user.id, role)
      void load(query)
    }
  }

  const handleBatchEnable = async () => {
    const result = await confirmPasswordAction(
      '批量启用用户',
      <>确定要启用选中的 <b>{selectedRowKeys.length}</b> 个用户吗？</>,
    )
    if (!result.confirmed) return
    await Promise.all(
      selectedRowKeys.map(async (key) => {
        const u = data.find((d) => d.id === key)
        if (u && !u.isActive) await toggleUserStatus(u.id, false)
      }),
    )
    message.success('批量启用成功')
    setSelectedRowKeys([])
    void load(query)
  }

  const handleBatchDisable = async () => {
    const result = await confirmPasswordAction(
      '批量禁用用户',
      <>确定要禁用选中的 <b>{selectedRowKeys.length}</b> 个用户吗？</>,
    )
    if (!result.confirmed) return
    await Promise.all(
      selectedRowKeys.map(async (key) => {
        const u = data.find((d) => d.id === key)
        if (u && u.isActive) await toggleUserStatus(u.id, true)
      }),
    )
    message.success('批量禁用成功')
    setSelectedRowKeys([])
    void load(query)
  }

  const handleBatchDelete = async () => {
    const result = await confirmPasswordAction(
      '批量删除用户',
      <>确定要删除选中的 <b>{selectedRowKeys.length}</b> 个用户吗？该操作不可撤销。</>,
    )
    if (!result.confirmed) return
    await Promise.all(
      selectedRowKeys.map((key) => deleteUserService(String(key))),
    )
    message.success('批量删除成功')
    setSelectedRowKeys([])
    void load(query)
  }

  const columns: ColumnsType<AdminUserResponse> = [
    {
      title: '用户',
      dataIndex: 'email',
      key: 'email',
      width: 220,
      render: (_: unknown, record) => (
        <div className="flex items-center gap-3">
          <Avatar
            size="small"
            style={{ backgroundColor: record.role === 'ADMIN' ? '#4f46e5' : '#10b981' }}
          >
            {(record.name ?? record.email)[0].toUpperCase()}
          </Avatar>
          <div>
            <div className="text-sm font-medium text-slate-700">{record.name ?? '未命名'}</div>
            <div className="text-xs text-slate-500">{record.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string) =>
        role === 'ADMIN' ? <Tag color="purple">管理员</Tag> : <Tag>普通用户</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 120,
      render: (isActive: boolean) =>
        isActive ? (
          <StatusTag status="success" text="已启用" />
        ) : (
          <StatusTag status="default" text="已禁用" />
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => <span className="text-sm text-slate-500">{new Date(v).toLocaleString('zh-CN')}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 320,
      render: (_: unknown, record) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<Edit size={14} />}
            onClick={() => navigate({ to: `/_authenticated/users/${record.id}` })}
          >
            编辑
          </Button>
          <Button
            type="text"
            size="small"
            icon={<KeyRound size={14} />}
            onClick={() => void handleResetPassword(record)}
          >
            重置密码
          </Button>
          <Button
            type="text"
            size="small"
            icon={<UserCog size={14} />}
            onClick={() => void handleAssignRole(record)}
          >
            分配角色
          </Button>
          <Switch
            size="small"
            checked={record.isActive}
            onChange={() => void handleToggleStatus(record)}
          />
          <Popconfirm
            title="确定删除此用户？"
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
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="用户管理"
        description="管理系统用户，支持创建、启禁用、删除、重置密码等操作"
        extra={
          <Space>
            <Button icon={<RefreshCw size={14} />} onClick={() => void load(query)}>
              刷新
            </Button>
            <Button type="primary" icon={<Plus size={14} />} onClick={() => void handleCreate()}>
              新建用户
            </Button>
          </Space>
        }
      />

      <Card>
        <Space wrap size="middle" className="mb-4">
          <Input
            allowClear
            prefix={<Search size={14} className="text-slate-400" />}
            placeholder="按邮箱搜索"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 240 }}
          />
          <Select
            placeholder="角色"
            value={roleFilter}
            onChange={setRoleFilter}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '全部角色' },
              { value: 'ADMIN', label: '管理员' },
              { value: 'USER', label: '普通用户' },
            ]}
          />
          <Select
            placeholder="状态"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'active', label: '已启用' },
              { value: 'disabled', label: '已禁用' },
            ]}
          />
          <Button type="primary" onClick={handleSearch}>
            搜索
          </Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>

        {selectedRowKeys.length > 0 && (
          <Space wrap size="small" className="mb-4 rounded-md border border-indigo-200 bg-indigo-50 p-2">
            <span className="text-sm text-indigo-700">
              已选 <b>{selectedRowKeys.length}</b> 项
            </span>
            <Button
              size="small"
              icon={<Users size={14} />}
              onClick={() => void handleBatchEnable()}
            >
              批量启用
            </Button>
            <Button
              size="small"
              icon={<Users size={14} />}
              onClick={() => void handleBatchDisable()}
            >
              批量禁用
            </Button>
            <Button
              size="small"
              danger
              icon={<Trash2 size={14} />}
              onClick={() => void handleBatchDelete()}
            >
              批量删除
            </Button>
            <Button
              size="small"
              type="link"
              onClick={() => setSelectedRowKeys([])}
            >
              取消选择
            </Button>
          </Space>
        )}

        <Table<AdminUserResponse>
          rowKey="id"
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
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
              void load({ ...query, page, pageSize })
            },
          }}
          locale={{
            emptyText: <EmptyState description="暂无用户数据" actionText="新建第一个用户" onAction={handleCreate} />,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  )
}
