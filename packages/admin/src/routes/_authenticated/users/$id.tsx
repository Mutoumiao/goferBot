import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { App, Button, Card, Descriptions, Form, Input, Select, Space, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import type { AdminUserResponse } from '@/features/users/services'
import { fetchUser, updateUserService } from '@/features/users/services'
import type { AdminRoleCode } from '@/stores/auth'

export const Route = createFileRoute('/_authenticated/users/$id')({
  component: UserDetailPage,
})

const ROLE_OPTIONS: { value: AdminRoleCode; label: string }[] = [
  { value: 'user', label: '普通用户' },
  { value: 'admin', label: '管理员' },
  { value: 'super_admin', label: '超级管理员' },
]

function renderRoleTags(roles: string[]) {
  return (
    <Space size={4}>
      {roles.includes('super_admin') && <Tag color="red">超级管理员</Tag>}
      {roles.includes('admin') && !roles.includes('super_admin') && (
        <Tag color="purple">管理员</Tag>
      )}
      {roles.includes('user') && !roles.includes('admin') && !roles.includes('super_admin') && (
        <Tag>普通用户</Tag>
      )}
    </Space>
  )
}

function UserDetailPage() {
  const params = Route.useParams()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [user, setUser] = useState<AdminUserResponse | null>(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const load = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const u = await fetchUser(params.id)
      setUser(u)
      if (u) {
        form.setFieldsValue({ name: u.name, roles: u.roles })
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!user) return
    try {
      const values = await form.validateFields()
      const res = await updateUserService(user.id, {
        name: values.name,
        roles: values.roles,
        updatedAt: user.updatedAt,
      })
      if (res.success) {
        setEditing(false)
        void load()
      } else if (res.conflict) {
        message.error('数据已被他人修改，已为您刷新到最新版本')
        void load()
      }
    } catch {
      // handled in service
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="用户详情"
        onBack={() => navigate({ to: '/users' })}
        extra={
          !editing ? (
            <Button type="primary" onClick={() => setEditing(true)}>
              编辑
            </Button>
          ) : (
            <Space>
              <Button onClick={() => setEditing(false)}>取消</Button>
              <Button type="primary" onClick={() => void handleSave()}>
                保存
              </Button>
            </Space>
          )
        }
      />

      <Card loading={loading}>
        {loadError ? (
          <div className="py-16 text-center text-slate-400">加载失败</div>
        ) : !user ? (
          <div className="py-16 text-center text-slate-400">用户不存在</div>
        ) : !editing ? (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="ID">{user.id}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{user.email}</Descriptions.Item>
            <Descriptions.Item label="昵称">{user.name ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="角色">{renderRoleTags(user.roles ?? [])}</Descriptions.Item>
            <Descriptions.Item label="状态">
              {user.isActive ? <Tag color="green">已启用</Tag> : <Tag color="default">已禁用</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {new Date(user.createdAt).toLocaleString('zh-CN')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {new Date(user.updatedAt).toLocaleString('zh-CN')}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Form form={form} layout="vertical" className="max-w-md">
            <Form.Item label="邮箱">
              <Input disabled value={user.email} />
            </Form.Item>
            <Form.Item name="name" label="昵称">
              <Input placeholder="选填" />
            </Form.Item>
            <Form.Item
              name="roles"
              label="角色"
              rules={[{ required: true, message: '请选择角色' }]}
            >
              <Select mode="multiple" options={ROLE_OPTIONS} />
            </Form.Item>
            <p className="text-xs text-slate-500">
              版本号：{user.updatedAt}（保存时若版本不一致将提示冲突）
            </p>
          </Form>
        )}
      </Card>
    </div>
  )
}
