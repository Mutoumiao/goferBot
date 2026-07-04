import { Card, Descriptions, Space, Tag } from 'antd'
import { useAuthStore } from '@/stores/auth'

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

export function BasicInfoCard() {
  const user = useAuthStore((s) => s.user)

  return (
    <Card>
      <Descriptions column={1} bordered>
        <Descriptions.Item label="ID">{user?.id}</Descriptions.Item>
        <Descriptions.Item label="邮箱">{user?.email}</Descriptions.Item>
        <Descriptions.Item label="昵称">{user?.name ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="角色">
          {user?.roles ? renderRoleTags(user.roles) : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={user?.isActive ? 'green' : 'default'}>
            {user?.isActive ? '已启用' : '已禁用'}
          </Tag>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )
}
