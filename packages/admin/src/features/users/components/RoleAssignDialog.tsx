import { Modal, Select } from 'antd'
import { useState } from 'react'
import type { AdminRoleCode } from '@/stores/auth'
import { confirmPasswordAction } from '@/utils/confirm-action'
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

function getRoleLabel(roles: string[]): string {
  if (roles.includes('super_admin')) return '超级管理员'
  if (roles.includes('admin')) return '管理员'
  return '普通用户'
}

export function assignRoleModal(user: AdminUserResponse): Promise<AdminRoleCode[] | null> {
  return new Promise((resolve) => {
    const [roles, setRoles] = useState<AdminRoleCode[]>([...(user.roles ?? [])] as AdminRoleCode[])

    const modal = Modal.confirm({
      title: '分配角色',
      width: 400,
      content: (
        <div className="space-y-3 pt-2">
          <p className="text-sm text-slate-600">
            正在为用户 <b>{user.email}</b> 分配角色
          </p>
          <div>
            <label className="mb-1 block text-sm text-slate-600">角色</label>
            <Select
              mode="multiple"
              value={roles}
              onChange={(v) => {
                setRoles(v)
              }}
              style={{ width: '100%' }}
              options={ROLE_OPTIONS}
            />
          </div>
        </div>
      ),
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        if (rolesEqual(roles, user.roles ?? [])) {
          resolve(null)
          modal.destroy()
          return
        }
        const result = await confirmPasswordAction(
          '分配角色',
          `请输入当前登录密码以确认将 ${user.email} 角色变更为 ${getRoleLabel(roles)}`,
        )
        if (!result.confirmed) {
          resolve(null)
          modal.destroy()
          return Promise.reject(new Error('cancelled'))
        }
        resolve(roles)
      },
      onCancel: () => {
        resolve(null)
        modal.destroy()
      },
    })
  })
}
