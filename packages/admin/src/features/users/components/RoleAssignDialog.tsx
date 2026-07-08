import { Modal, Select } from 'antd'
import type { AdminRoleCode } from '@/stores/auth'
import type { AdminUserResponse } from '../services'

const ROLE_OPTIONS: { value: AdminRoleCode; label: string }[] = [
  { value: 'user', label: '普通用户' },
  { value: 'admin', label: '管理员' },
  { value: 'super_admin', label: '超级管理员' },
]

function rolesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((v, i) => v === sortedB[i])
}

export function assignRoleModal(user: AdminUserResponse): Promise<AdminRoleCode[] | null> {
  return new Promise((resolve) => {
    let currentRoles: AdminRoleCode[] = [...(user.roles ?? [])] as AdminRoleCode[]

    const renderContent = () => (
      <div className="space-y-3 pt-2">
        <p className="text-sm text-slate-600">
          正在为用户 <b>{user.email}</b> 分配角色
        </p>
        <div>
          <label className="mb-1 block text-sm text-slate-600">角色</label>
          <Select
            mode="multiple"
            value={currentRoles}
            onChange={(v) => {
              currentRoles = v
              modal.update({ content: renderContent() })
            }}
            style={{ width: '100%' }}
            options={ROLE_OPTIONS}
          />
        </div>
      </div>
    )

    const modal = Modal.confirm({
      title: '分配角色',
      width: 400,
      content: renderContent(),
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        if (rolesEqual(currentRoles, user.roles ?? [])) {
          resolve(null)
          modal.destroy()
          return
        }
        resolve(currentRoles)
        modal.destroy()
      },
      onCancel: () => {
        resolve(null)
        modal.destroy()
      },
    })
  })
}
