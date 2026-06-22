import { Modal } from 'antd'
import { useState } from 'react'

export interface ConfirmPasswordResult {
  confirmed: boolean
  password?: string
}

/**
 * 危险操作二次确认（带密码）。
 * 返回 Promise：用户确认且密码验证通过 → resolve({ confirmed: true, password })；
 * 取消或密码错误 → resolve({ confirmed: false })。
 *
 * 说明：真实项目中密码校验通常通过后端完成。这里只负责 UI 流程。
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
      onOk: () => {
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
        resolve({ confirmed: true, password: inputPassword })
        modal.destroy()
      },
      onCancel: () => {
        resolve({ confirmed: false })
        modal.destroy()
      },
    })
  })
}

function PasswordInput({
  onChange,
}: {
  onChange: (value: string, error?: string) => void
}) {
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
