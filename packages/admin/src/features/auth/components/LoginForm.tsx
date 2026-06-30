import { useNavigate, useSearch } from '@tanstack/react-router'
import { Alert, Button, Checkbox, Input, Modal, Progress } from 'antd'
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CaptchaResponse } from '@/api/auth'
import { ROUTES_REGISTER } from '@/router-register'
import { validatePassword } from '@/utils/password'
import { getRememberedEmail, loginService, setRememberedEmail } from '../services'
import { CaptchaInput } from './CaptchaInput'

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

function showForgotPasswordModal() {
  Modal.info({
    title: '忘记密码',
    icon: <ShieldAlert size={20} className="text-amber-500" />,
    content: (
      <div className="mt-2 space-y-2 text-sm text-slate-600">
        <p>出于安全考虑，管理员密码重置需要由超级管理员操作。</p>
        <p>请联系系统超级管理员进行密码重置。</p>
        <p className="text-xs text-slate-400">
          如果您是超级管理员本人，请通过服务器终端或数据库直接重置。
        </p>
      </div>
    ),
    okText: '知道了',
    centered: true,
  })
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
  const [captchaError, setCaptchaError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)

  const [captchaChallenge, setCaptchaChallenge] = useState<CaptchaResponse | null>(null)
  const [captcha, setCaptcha] = useState('')

  const strength = evaluatePasswordStrength(password)
  const isLocked = lockedUntil !== null && Date.now() < lockedUntil

  const validate = (): boolean => {
    let valid = true
    setEmailError(null)
    setPasswordError(null)
    setCaptchaError(null)
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
    } else {
      const pwdErr = validatePassword(password)
      if (pwdErr) {
        setPasswordError(pwdErr)
        valid = false
      }
    }

    if (!captcha.trim()) {
      setCaptchaError('请输入验证码')
      valid = false
    } else if (captcha.length !== 4) {
      setCaptchaError('验证码为 4 位字符')
      valid = false
    }

    return valid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (isLocked) {
      const remaining = Math.ceil(((lockedUntil ?? 0) - Date.now()) / 1000)
      setError(`尝试次数过多，请在 ${remaining} 秒后重试`)
      return
    }
    if (!validate()) return

    if (!captchaChallenge) {
      setCaptchaError('验证码尚未加载，请刷新后重试')
      return
    }

    setLoading(true)
    const result = await loginService(email, password, {
      captchaId: captchaChallenge.captchaId,
      captchaCode: captcha,
    })
    setLoading(false)

    if (result.success) {
      if (remember) {
        setRememberedEmail(email)
      } else {
        setRememberedEmail(null)
      }
      navigate({
        to: search.redirect || ROUTES_REGISTER.dashboard.path,
        replace: true,
      })
    } else {
      setError(result.error ?? '登录失败')
      const newAttempts = attempts + 1
      setAttempts(newAttempts)
      // 登录失败后清空验证码输入，由 CaptchaInput 自动刷新图片
      setCaptcha('')
      if (newAttempts >= 5) {
        setLockedUntil(Date.now() + 60 * 1000)
        setAttempts(0)
      }
    }
  }

  // 锁定时每秒更新剩余时间
  const [lockCountdown, setLockCountdown] = useState(0)
  useEffect(() => {
    if (!isLocked) return
    const timer = setInterval(() => {
      const remaining = Math.ceil(((lockedUntil ?? 0) - Date.now()) / 1000)
      if (remaining <= 0) {
        setLockedUntil(null)
        clearInterval(timer)
      }
      setLockCountdown(remaining < 0 ? 0 : remaining)
    }, 1000)
    return () => clearInterval(timer)
  }, [isLocked, lockedUntil])

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-4">
        {/* 邮箱 */}
        <div className="group">
          <label className="mb-1.5 block text-sm font-medium text-slate-300">邮箱</label>
          <Input
            prefix={
              <Mail
                size={16}
                className="text-slate-400 transition-colors group-focus-within:text-amber-500"
              />
            }
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (emailError) setEmailError(null)
            }}
            placeholder="请输入管理员邮箱"
            status={emailError ? 'error' : undefined}
            size="large"
            autoComplete="email"
          />
          {emailError && <p className="mt-1 text-xs text-red-400">{emailError}</p>}
        </div>

        {/* 密码 */}
        <div className="group">
          <label className="mb-1.5 block text-sm font-medium text-slate-300">密码</label>
          <Input.Password
            prefix={
              <Lock
                size={16}
                className="text-slate-400 transition-colors group-focus-within:text-amber-500"
              />
            }
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (passwordError) setPasswordError(null)
            }}
            placeholder="请输入密码（至少 8 位）"
            status={passwordError ? 'error' : undefined}
            size="large"
            autoComplete="current-password"
            iconRender={(visible) =>
              visible ? (
                <EyeOff size={16} className="text-slate-400" />
              ) : (
                <Eye size={16} className="text-slate-400" />
              )
            }
            onFocus={() => setShowPassword(true)}
          />
          {passwordError && <p className="mt-1 text-xs text-red-400">{passwordError}</p>}
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
                trailColor="rgba(255,255,255,0.1)"
              />
              <span className="text-xs text-slate-500">{strength.label}</span>
            </div>
          )}
        </div>

        {/* 验证码 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">验证码</label>
          <CaptchaInput
            value={captcha}
            onChange={(v) => {
              setCaptcha(v)
              if (captchaError) setCaptchaError(null)
            }}
            onChallengeChange={setCaptchaChallenge}
            status={captchaError ? 'error' : undefined}
          />
          {captchaError && <p className="mt-1 text-xs text-red-400">{captchaError}</p>}
        </div>
      </div>

      {/* 记住我 + 忘记密码 */}
      <div className="flex items-center justify-between">
        <Checkbox
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="text-slate-400"
        >
          <span className="text-sm text-slate-400">记住我</span>
        </Checkbox>
        <button
          type="button"
          onClick={showForgotPasswordModal}
          className="text-sm text-amber-500/80 transition-colors hover:text-amber-400 hover:underline"
        >
          忘记密码？
        </button>
      </div>

      {/* 全局错误 */}
      {error && (
        <Alert
          type="error"
          message={error}
          showIcon
          className="rounded-lg border-red-500/20 bg-red-500/10 text-red-300"
        />
      )}

      {/* 登录按钮 */}
      <Button
        type="primary"
        htmlType="submit"
        disabled={loading || isLocked}
        loading={loading}
        size="large"
        block
        className="!h-12 !rounded-xl !text-base !font-semibold !shadow-lg !shadow-amber-500/20"
        style={{
          background: loading
            ? undefined
            : 'linear-gradient(135deg, #c88d2f 0%, #d4a853 50%, #b8860b 100%)',
          border: 'none',
        }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            验证中...
          </span>
        ) : isLocked ? (
          `已锁定 ${lockCountdown > 0 ? `${lockCountdown}s` : ''}`
        ) : (
          '登 录 后 台'
        )}
      </Button>
    </form>
  )
}
