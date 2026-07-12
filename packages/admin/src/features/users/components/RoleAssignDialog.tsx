import type { AdminRoleCode } from '@/stores/auth'
import { useAuthStore } from '@/stores/auth'
import type { AppModal } from '@/utils/antd-app'
import { getAppModal } from '@/utils/antd-app'
import type { AdminUserResponse } from '../services'
import { RoleSelect } from './RoleSelect'

export function assignRoleModal(
  user: AdminUserResponse,
  modalApi?: AppModal,
): Promise<AdminRoleCode | null> {
  const modal = modalApi ?? getAppModal()
  return new Promise((resolve) => {
    const currentUserRoles = (useAuthStore.getState().user?.roles ?? []) as AdminRoleCode[]
    const currentRole: AdminRoleCode = (user.roles?.[0] as AdminRoleCode | undefined) ?? 'user'
    let selectedRole: AdminRoleCode = currentRole

    const renderContent = () => (
      <div className="space-y-3 pt-2">
        <p className="text-sm text-slate-600">
          正在为用户 <b>{user.email}</b> 分配角色
        </p>
        <div>
          <label className="mb-1 block text-sm text-slate-600">角色</label>
          <RoleSelect
            currentUserRoles={currentUserRoles}
            defaultValue={currentRole}
            onChange={(v) => {
              selectedRole = v
              roleModalRef.update({ content: renderContent() })
            }}
          />
        </div>
      </div>
    )

    const roleModalRef = modal.confirm({
      title: '分配角色',
      icon: null,
      width: 400,
      content: renderContent(),
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        if (selectedRole === currentRole) {
          resolve(null)
          roleModalRef.destroy()
          return
        }
        resolve(selectedRole)
        roleModalRef.destroy()
      },
      onCancel: () => {
        resolve(null)
        roleModalRef.destroy()
      },
    })
  })
}
