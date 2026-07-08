import { Space, Tag } from 'antd'

export function renderRoleTags(roles: string[]) {
  const effectiveRoles = roles.length === 0 ? ['user'] : roles
  return (
    <Space size={4}>
      {effectiveRoles.includes('super_admin') && <Tag color="red">超级管理员</Tag>}
      {effectiveRoles.includes('admin') && !effectiveRoles.includes('super_admin') && (
        <Tag color="purple">管理员</Tag>
      )}
      {effectiveRoles.includes('user') &&
        !effectiveRoles.includes('admin') &&
        !effectiveRoles.includes('super_admin') && <Tag>普通用户</Tag>}
    </Space>
  )
}
