import { Modal, Select } from 'antd'
import { useState } from 'react'
import type { AdminUserResponse } from '@/api/admin'
import { confirmPasswordAction } from '@/utils/confirm-action'

export function assignRoleModal(
  user: AdminUserResponse,
): Promise<'ADMIN' | 'USER' | null> {
  return new Promise((resolve) => {
    const [role, setRole] = useState<'ADMIN' | 'USER'>(user.role)
    const [error, setError] = useState<string | null>(null)

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
              value={role}
              onChange={(v) => {
                setRole(v)
                setError(null)
              }}
              style={{ width: '100%' }}
              options={[
                { value: 'USER', label: '普通用户' },
                { value: 'ADMIN', label: '管理员' },
              ]}
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      ),
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        if (role === user.role) {
          resolve(null)
          modal.destroy()
          return
        }
        const result = await confirmPasswordAction(
          '分配角色',
          `请输入当前登录密码以确认将 ${user.email} 角色变更为 ${role === 'ADMIN' ? '管理员' : '普通用户'}`,
        )
        if (!result.confirmed) {
          resolve(null)
          modal.destroy()
          return Promise.reject(new Error('cancelled'))
        }
        resolve(role)
      },
      onCancel: () => {
        resolve(null)
        modal.destroy()
      },
    })
  })
}
