import { Input, Modal } from 'antd'
import { useState } from 'react'
import { resetUserPassword } from '../services'
import { confirmPasswordAction } from '@/utils/confirm-action'
import type { AdminUserResponse } from '../services'

export function resetPasswordModal(user: AdminUserResponse): Promise<boolean> {
  return new Promise((resolve) => {
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [error, setError] = useState<string | null>(null)

    const modal = Modal.confirm({
      title: '重置密码',
      width: 420,
      content: (
        <div className="space-y-3 pt-2">
          <p className="text-sm text-slate-600">
            正在为用户 <b>{user.email}</b> 重置密码
          </p>
          <div>
            <label className="mb-1 block text-sm text-slate-600">新密码</label>
            <Input.Password
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(null)
              }}
              placeholder="至少 8 位"
              status={error ? 'error' : undefined}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">确认密码</label>
            <Input.Password
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value)
                setError(null)
              }}
              placeholder="再次输入新密码"
              status={error ? 'error' : undefined}
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      ),
      okText: '重置',
      cancelText: '取消',
      onOk: async () => {
        if (!password || password.length < 8) {
          setError('密码至少 8 位')
          return Promise.reject(new Error('weak'))
        }
        if (password !== confirm) {
          setError('两次密码不一致')
          return Promise.reject(new Error('mismatch'))
        }
        const result = await confirmPasswordAction('重置密码', '请输入当前登录密码以确认')
        if (!result.confirmed) {
          resolve(false)
          modal.destroy()
          return Promise.reject(new Error('cancelled'))
        }
        const res = await resetUserPassword(user.id, password)
        if (res.success) {
          resolve(true)
          modal.destroy()
        } else {
          setError(res.error ?? '重置失败')
          return Promise.reject(new Error('failed'))
        }
      },
      onCancel: () => {
        resolve(false)
        modal.destroy()
      },
    })
  })
}
