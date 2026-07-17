import type { MenuProps } from 'antd'
import {
  App,
  Avatar,
  Button,
  Card,
  Dropdown,
  Input,
  Select,
  Space,
  Switch,
  Table,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { MoreHorizontal, Plus, RefreshCw, Search, Trash2, Users } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { useAuthStore } from '@/stores/auth'
import { confirmPasswordAction } from '@/utils/confirm-action'
import type { AdminUserResponse, ListUsersQuery } from '../services'
import { assignUserRole, deleteUserService, fetchUsers, toggleUserStatus } from '../services'
import { getMenuItems } from './menuItems'
import { resetPasswordModal } from './ResetPasswordDialog'
import { assignRoleModal } from './RoleAssignDialog'
import { renderRoleTags } from './renderRoleTags'
import { showCreateUserModal, showEditUserModal } from './UserFormModal'

type RoleFilter = 'all' | 'super_admin' | 'admin' | 'user'

export interface UserTableProps {
  initialQuery?: ListUsersQuery
}

function avatarColor(roles: string[]): string {
  if (roles.includes('super_admin')) return '#dc2626'
  if (roles.includes('admin')) return '#4f46e5'
  return '#10b981'
}

export function UserTable({ initialQuery }: UserTableProps) {
  const { modal: appModal, message } = App.useApp()
  const currentUser = useAuthStore((s) => s.user)
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
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all')

  const initialQueryRef = useRef<ListUsersQuery>({
    page: 1,
    pageSize: 10,
    ...initialQuery,
  })

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
    void load(initialQueryRef.current)
  }, [load])

  const handleSearch = () => {
    const q: ListUsersQuery = {
      ...query,
      page: 1,
      search: searchInput.trim() || undefined,
      role: roleFilter === 'all' ? undefined : roleFilter,
      isActive: statusFilter === 'all' ? undefined : statusFilter === 'active' ? true : false,
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

  const handleEdit = async (user: AdminUserResponse) => {
    const success = await showEditUserModal(user, appModal)
    if (success) void load(query)
  }

  const handleDelete = async (user: AdminUserResponse) => {
    await deleteUserService(user.id)
    void load(query)
  }

  const handleCreate = async () => {
    const success = await showCreateUserModal(appModal)
    if (success) void load(query)
  }

  const handleResetPassword = async (user: AdminUserResponse) => {
    const success = await resetPasswordModal(user, appModal)
    if (success) message.success('密码已重置')
  }

  const handleAssignRole = async (user: AdminUserResponse) => {
    const role = await assignRoleModal(user, appModal)
    if (role) {
      await assignUserRole(user.id, [role])
      void load(query)
    }
  }
  const handleBatchEnable = async () => {
    const result = await confirmPasswordAction(
      '批量启用用户',
      <>
        确定要启用选中的 <b>{selectedRowKeys.length}</b> 个用户吗？
      </>,
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
      <>
        确定要禁用选中的 <b>{selectedRowKeys.length}</b> 个用户吗？
      </>,
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
      <>
        确定要删除选中的 <b>{selectedRowKeys.length}</b> 个用户吗？该操作不可撤销。
      </>,
    )
    if (!result.confirmed) return
    await Promise.all(selectedRowKeys.map((key) => deleteUserService(String(key))))
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
          <Avatar size="small" style={{ backgroundColor: avatarColor(record.roles ?? []) }}>
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
      dataIndex: 'roles',
      key: 'roles',
      width: 160,
      render: (roles: string[] | undefined) => renderRoleTags(roles ?? []),
    },
    {
      title: '启用',
      key: 'enabled',
      width: 80,
      render: (_: unknown, record) => {
        const isSelf = currentUser ? record.id === currentUser.id : false
        return (
          <Switch
            size="small"
            checked={record.isActive}
            disabled={isSelf}
            onChange={() => void handleToggleStatus(record)}
          />
        )
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => (
        <span className="text-sm text-slate-500">{new Date(v).toLocaleString('zh-CN')}</span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record) => {
        if (!currentUser) return null
        const items = getMenuItems(record, currentUser)
        if (items.length === 0) return null

        const menuItems: MenuProps['items'] = items.map((item) => ({
          key: item.key,
          label: (
            <span className="flex items-center gap-2">
              {item.icon}
              {item.label}
            </span>
          ),
          danger: item.danger,
          onClick: () => {
            if (item.key === 'edit') void handleEdit(record)
            else if (item.key === 'resetPassword') void handleResetPassword(record)
            else if (item.key === 'assignRole') void handleAssignRole(record)
            else if (item.key === 'delete') {
              appModal.confirm({
                title: '删除用户',
                icon: null,
                content: `确定删除用户 ${record.email}？删除后数据无法恢复。`,
                okText: '删除',
                okButtonProps: { danger: true },
                cancelText: '取消',
                onOk: () => handleDelete(record),
              })
            }
          },
        }))

        return (
          <Dropdown menu={{ items: menuItems }} trigger={['click']}>
            <Button type="text" size="small" icon={<MoreHorizontal size={14} />} />
          </Dropdown>
        )
      },
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
              { value: 'super_admin', label: '超级管理员' },
              { value: 'admin', label: '管理员' },
              { value: 'user', label: '普通用户' },
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
          <Space
            wrap
            size="small"
            className="mb-4 rounded-md border border-indigo-200 bg-indigo-50 p-2"
          >
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
            <Button size="small" type="link" onClick={() => setSelectedRowKeys([])}>
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
            emptyText: (
              <EmptyState
                description="暂无用户数据"
                actionText="新建第一个用户"
                onAction={handleCreate}
              />
            ),
          }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  )
}
