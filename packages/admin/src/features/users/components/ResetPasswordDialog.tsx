import { Input } from 'antd'
import type { AppModal } from '@/utils/antd-app'
import { getAppModal } from '@/utils/antd-app'
import { confirmPasswordAction } from '@/utils/confirm-action'
import type { AdminUserResponse } from '../services'
import { resetUserPassword } from '../services'

export function resetPasswordModal(
  user: AdminUserResponse,
  modalApi?: AppModal,
): Promise<boolean> {
  const modal = modalApi ?? getAppModal()
  return new Promise((resolve) => {
    let password = ''
    let confirm = ''
    let error: string | null = null

    const renderContent = () => (
      <div className="space-y-3 pt-2">
        <p className="text-sm text-slate-600">
          正在为用户 <b>{user.email}</b> 重置密码
        </p>
        <div>
          <label className="mb-1 block text-sm text-slate-600">新密码</label>
          <Input.Password
            placeholder="至少 8 位"
            status={error ? 'error' : undefined}
            onChange={(e) => {
              password = e.target.value
              error = null
              passwordModalRef.update({ content: renderContent() })
            }}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">确认密码</label>
          <Input.Password
            placeholder="再次输入新密码"
            status={error ? 'error' : undefined}
            onChange={(e) => {
              confirm = e.target.value
              error = null
              passwordModalRef.update({ content: renderContent() })
            }}
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )

    const passwordModalRef = modal.confirm({
      title: '重置密码',
      icon: null,
      width: 420,
      content: renderContent(),
      okText: '重置',
      cancelText: '取消',
      onOk: async () => {
        if (!password || password.length < 8) {
          error = '密码至少 8 位'
          passwordModalRef.update({ content: renderContent() })
          return Promise.reject(new Error('weak'))
        }
        if (password !== confirm) {
          error = '两次密码不一致'
          passwordModalRef.update({ content: renderContent() })
          return Promise.reject(new Error('mismatch'))
        }
        const result = await confirmPasswordAction('重置密码', '请输入当前登录密码以确认')
        if (!result.confirmed) {
          resolve(false)
          passwordModalRef.destroy()
          return Promise.reject(new Error('cancelled'))
        }
        const res = await resetUserPassword(user.id, password)
        if (res.success) {
          resolve(true)
          passwordModalRef.destroy()
        } else {
          error = res.error ?? '重置失败'
          passwordModalRef.update({ content: renderContent() })
          return Promise.reject(new Error('failed'))
        }
      },
      onCancel: () => {
        resolve(false)
        passwordModalRef.destroy()
      },
    })
  })
}
