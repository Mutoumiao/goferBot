import { Card, Descriptions, Tag } from 'antd'
import { useAuthStore } from '@/stores/auth'

export function BasicInfoCard() {
  const user = useAuthStore((s) => s.user)

  return (
    <Card>
      <Descriptions column={1} bordered>
        <Descriptions.Item label="ID">{user?.id}</Descriptions.Item>
        <Descriptions.Item label="邮箱">{user?.email}</Descriptions.Item>
        <Descriptions.Item label="昵称">{user?.name ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="角色">
          <Tag color="purple">{user?.role ?? '—'}</Tag>
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
