import { Alert, Button, Checkbox, Form, Input, Progress } from 'antd'
import { Eye, EyeOff, Loader2, Lock, User2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { getRememberedEmail, loginService, setRememberedEmail } from '../services'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface PasswordStrength {
  score: number
  label: string
  color: string
  percent: number
}

function evaluatePasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: '—', color: 'default', percent: 0 }
  let score = 0
  if (password.length >= 8) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  const map: Record<number, PasswordStrength> = {
    0: { score: 0, label: '过弱', color: 'red', percent: 25 },
    1: { score: 1, label: '较弱', color: 'orange', percent: 50 },
    2: { score: 2, label: '一般', color: 'yellow', percent: 65 },
    3: { score: 3, label: '较强', color: 'blue', percent: 80 },
    4: { score: 4, label: '很强', color: 'green', percent: 100 },
  }
  return map[score] ?? map[0]
}

export function LoginForm() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { redirect?: string }
  const [email, setEmail] = useState(getRememberedEmail() ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(!!getRememberedEmail())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)

  const strength = evaluatePasswordStrength(password)
  const isLocked = lockedUntil !== null && Date.now() < lockedUntil

  const validate = (): boolean => {
    let valid = true
    setEmailError(null)
    setPasswordError(null)
    setError(null)

    if (!email.trim()) {
      setEmailError('请输入邮箱地址')
      valid = false
    } else if (!EMAIL_REGEX.test(email)) {
      setEmailError('请输入有效的邮箱地址')
      valid = false
    }

    if (!password) {
      setPasswordError('请输入密码')
      valid = false
    } else if (password.length < 8) {
      setPasswordError('密码长度至少 8 位')
      valid = false
    }

    return valid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (isLocked) {
      setError(`尝试次数过多，请在 ${Math.ceil(((lockedUntil ?? 0) - Date.now()) / 1000)} 秒后重试`)
      return
    }
    if (!validate()) return

    setLoading(true)
    const result = await loginService(email, password)
    setLoading(false)

    if (result.success) {
      if (remember) {
        setRememberedEmail(email)
      } else {
        setRememberedEmail(null)
      }
      navigate({
        to: search.redirect || '/_authenticated/dashboard',
        replace: true,
      })
    } else {
      setError(result.error ?? '登录失败')
      const newAttempts = attempts + 1
      setAttempts(newAttempts)
      if (newAttempts >= 5) {
        setLockedUntil(Date.now() + 60 * 1000)
        setAttempts(0)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">邮箱</label>
          <Input
            prefix={<User2 size={16} className="text-slate-400" />}
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (emailError) setEmailError(null)
            }}
            placeholder="请输入管理员邮箱"
            status={emailError ? 'error' : undefined}
            size="large"
          />
          {emailError && <p className="mt-1 text-xs text-red-500">{emailError}</p>}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">密码</label>
          <Input.Password
            prefix={<Lock size={16} className="text-slate-400" />}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (passwordError) setPasswordError(null)
            }}
            placeholder="请输入密码（至少 8 位）"
            status={passwordError ? 'error' : undefined}
            size="large"
            iconRender={(visible) => (visible ? <EyeOff size={16} /> : <Eye size={16} />)}
            onFocus={() => setShowPassword(true)}
          />
          {passwordError && <p className="mt-1 text-xs text-red-500">{passwordError}</p>}
          {password.length > 0 && (
            <div className="mt-2">
              <Progress
                percent={strength.percent}
                size="small"
                showInfo={false}
                strokeColor={
                  strength.color === 'red'
                    ? '#ef4444'
                    : strength.color === 'orange'
                      ? '#f59e0b'
                      : strength.color === 'yellow'
                        ? '#eab308'
                        : strength.color === 'blue'
                          ? '#3b82f6'
                          : '#22c55e'
                }
              />
              <span className="text-xs text-slate-500">{strength.label}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)}>
          <span className="text-sm text-slate-600">记住我</span>
        </Checkbox>
        <button type="button" className="text-sm text-indigo-500 hover:underline">
          忘记密码？
        </button>
      </div>

      {error && <Alert type="error" message={error} showIcon className="rounded-lg" />}

      <Button
        type="primary"
        htmlType="submit"
        disabled={loading || isLocked}
        loading={loading}
        size="large"
        block
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            登录中...
          </>
        ) : isLocked ? (
          `已锁定，请稍后重试`
        ) : (
          '登录后台'
        )}
      </Button>
    </form>
  )
}
