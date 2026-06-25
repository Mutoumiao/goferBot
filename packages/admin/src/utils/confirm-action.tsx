import { Modal } from 'antd'
import { useState } from 'react'
import { verifyPassword } from '@/api/auth'
import { mapErrorMessage } from '@/utils/error-mapper'

export interface ConfirmPasswordResult {
  confirmed: boolean
  password?: string
}

/**
 * 危险操作二次确认（带密码 + 后端校验）。
 * 返回 Promise：密码校验通过 → resolve({ confirmed: true, password })；
 * 取消或密码错误 → resolve({ confirmed: false })。
 */
export function confirmPasswordAction(
  title: string,
  content?: React.ReactNode,
): Promise<ConfirmPasswordResult> {
  return new Promise((resolve) => {
    let inputPassword = ''
    let passwordError = '密码不能为空'

    const modal = Modal.confirm({
      title,
      icon: null,
      content: (
        <div className="space-y-3">
          {content ? <div>{content}</div> : null}
          <div className="text-sm text-muted-foreground">
            该操作不可撤销，请输入当前登录密码确认：
          </div>
          <PasswordInput
            onChange={(value, error) => {
              inputPassword = value
              passwordError = error ?? ''
            }}
          />
        </div>
      ),
      okText: '确认执行',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!inputPassword) {
          modal.update({
            content: (
              <div className="space-y-3">
                {content ? <div>{content}</div> : null}
                <div className="text-sm text-destructive">{passwordError}</div>
                <PasswordInput
                  onChange={(value, error) => {
                    inputPassword = value
                    passwordError = error ?? ''
                  }}
                />
              </div>
            ),
          })
          return Promise.reject(new Error('password required'))
        }
        try {
          const res = await verifyPassword({ password: inputPassword }).send()
          if (res.success) {
            resolve({ confirmed: true, password: inputPassword })
            modal.destroy()
            return
          }
          modal.update({
            content: (
              <div className="space-y-3">
                {content ? <div>{content}</div> : null}
                <div className="text-sm text-destructive">密码错误，请重新输入</div>
                <PasswordInput
                  onChange={(value, error) => {
                    inputPassword = value
                    passwordError = error ?? ''
                  }}
                />
              </div>
            ),
          })
          return Promise.reject(new Error('password invalid'))
        } catch (err) {
          const msg = mapErrorMessage(err)
          modal.update({
            content: (
              <div className="space-y-3">
                {content ? <div>{content}</div> : null}
                <div className="text-sm text-destructive">{msg || '密码校验失败，请重试'}</div>
                <PasswordInput
                  onChange={(value, error) => {
                    inputPassword = value
                    passwordError = error ?? ''
                  }}
                />
              </div>
            ),
          })
          return Promise.reject(new Error('verify failed'))
        }
      },
      onCancel: () => {
        resolve({ confirmed: false })
        modal.destroy()
      },
    })
  })
}

function PasswordInput({ onChange }: { onChange: (value: string, error?: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <input
      type="password"
      autoFocus
      value={value}
      onChange={(e) => {
        const v = e.target.value
        setValue(v)
        onChange(v, v.length === 0 ? '密码不能为空' : undefined)
      }}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      placeholder="请输入当前登录密码"
    />
  )
}
