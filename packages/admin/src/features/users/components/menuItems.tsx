import { Edit, KeyRound, Trash2, UserCog } from 'lucide-react'
import type { AdminUser } from '@/stores/auth'
import type { AdminUserResponse } from '../services'

export interface MenuItem {
  key: string
  label: string
  icon: React.ReactNode
  danger?: boolean
}

export function getMenuItems(record: AdminUserResponse, currentUser: AdminUser): MenuItem[] {
  const isSelf = record.id === currentUser.id
  const isTargetSuperAdmin = record.roles?.includes('super_admin')
  const currentIsSuperAdmin = currentUser.roles.includes('super_admin')
  const isTargetAdmin = record.roles?.includes('admin')

  const items: MenuItem[] = [{ key: 'edit', label: '编辑', icon: <Edit size={14} /> }]

  if (isSelf || isTargetSuperAdmin) return items
  if (!currentIsSuperAdmin && isTargetAdmin) return items

  items.push({ key: 'resetPassword', label: '重置密码', icon: <KeyRound size={14} /> })
  items.push({ key: 'assignRole', label: '分配角色', icon: <UserCog size={14} /> })
  items.push({ key: 'delete', label: '删除', icon: <Trash2 size={14} />, danger: true })

  return items
}
