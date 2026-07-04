import { useNavigate, useSearch } from '@tanstack/react-router'
import { Button, Checkbox, Input } from 'antd'
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import { useState } from 'react'
import type { CaptchaResponse } from '@/api/auth'
import { ROUTES_REGISTER } from '@/router-register'
import { useAuthStore } from '@/stores/auth'
import { validatePassword } from '@/utils/password'
import { getRememberedEmail, loginService, setRememberedEmail } from '../services'
import { CaptchaInput } from './CaptchaInput'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginForm() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { redirect?: string }
  const [email, setEmail] = useState(getRememberedEmail() ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(!!getRememberedEmail())
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [captchaError, setCaptchaError] = useState<string | null>(null)

  const [captchaChallenge, setCaptchaChallenge] = useState<CaptchaResponse | null>(null)
  const [captcha, setCaptcha] = useState('')

  const validate = (): boolean => {
    let valid = true
    setEmailError(null)
    setPasswordError(null)
    setCaptchaError(null)

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
      const redirectTo = search.redirect || ROUTES_REGISTER.dashboard.path
      navigate({
        to: redirectTo,
        replace: true,
      })
    } else {
      setCaptcha('')
    }
  }

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

      {/* 记住我 */}
      <div className="flex items-center">
        <Checkbox
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="text-slate-400"
        >
          <span className="text-sm text-slate-400">记住我</span>
        </Checkbox>
      </div>

      {/* 登录按钮 */}
      <Button
        type="primary"
        htmlType="submit"
        disabled={loading}
        loading={loading}
        size="large"
        block
        className="h-12! rounded-xl! text-base! font-semibold! shadow-lg! shadow-amber-500/20!"
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
        ) : (
          '登 录 后 台'
        )}
      </Button>
    </form>
  )
}
