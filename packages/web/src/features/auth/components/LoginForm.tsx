import { useNavigate } from '@tanstack/react-router'
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail, ShieldAlert } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Captcha, type CaptchaChallenge } from '@/components/ui/captcha'
import { Checkbox } from '@/components/ui/checkbox'
import { validatePassword } from '@/utils/password'
import { getRememberedEmail, loginUser } from '../services'
import { ForgotPassword } from './ForgotPassword'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FormField = 'email' | 'password' | 'captcha'

export function LoginForm() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [captchaVerified, setCaptchaVerified] = useState(false)
  const [captchaInput, setCaptchaInput] = useState('')
  const [captchaChallenge, setCaptchaChallenge] = useState<CaptchaChallenge | null>(null)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  const [touched, setTouched] = useState<Record<FormField, boolean>>({
    email: false,
    password: false,
    captcha: false,
  })
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    const remembered = getRememberedEmail()
    if (remembered) {
      setEmail(remembered)
      setRememberMe(true)
    }
  }, [])

  const validateField = useCallback((field: FormField, value: string): string | null => {
    switch (field) {
      case 'email': {
        if (!value.trim()) return '请输入邮箱地址'
        if (!EMAIL_REGEX.test(value)) return '请输入有效的邮箱地址'
        return null
      }
      case 'password':
        return validatePassword(value)
      case 'captcha':
        return null
    }
  }, [])

  const handleBlur = (field: FormField) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    const value = field === 'email' ? email : field === 'password' ? password : ''
    const err = validateField(field, value)
    if (field === 'email') setEmailError(err)
    if (field === 'password') setPasswordError(err)
  }

  const handleChange = (field: FormField, value: string) => {
    if (field === 'email') {
      setEmail(value)
      if (touched.email) setEmailError(validateField('email', value))
    }
    if (field === 'password') {
      setPassword(value)
      if (touched.password) setPasswordError(validateField('password', value))
    }
    if (error) setError(null)
  }

  const validate = (): boolean => {
    const emailErr = validateField('email', email)
    const passwordErr = validateField('password', password)
    setEmailError(emailErr)
    setPasswordError(passwordErr)
    setTouched({ email: true, password: true, captcha: true })
    return !emailErr && !passwordErr
  }

  const handleCaptchaVerify = useCallback((valid: boolean) => {
    setCaptchaVerified(valid)
  }, [])

  const handleCaptchaInput = useCallback((value: string) => {
    setCaptchaInput(value)
  }, [])

  const handleCaptchaChallengeChange = useCallback((challenge: CaptchaChallenge | null) => {
    setCaptchaChallenge(challenge)
    setCaptchaVerified(false)
    setCaptchaInput('')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validate()) return

    if (!captchaChallenge || !captchaVerified || captchaInput.length !== 4) {
      setError('请完成验证码验证')
      return
    }

    setLoading(true)
    try {
      const result = await loginUser(email, password, rememberMe, {
        captchaId: captchaChallenge.captchaId,
        captchaCode: captchaInput,
      })
      if (result.success) {
        navigate({ to: '/chats', replace: true })
      } else {
        setError(result.error ?? '登录失败')
      }
    } catch {
      setError('网络连接异常，请检查网络后重试')
    } finally {
      setLoading(false)
    }
  }

  if (showForgotPassword) {
    return (
      <div className="w-full">
        <ForgotPassword onBack={() => setShowForgotPassword(false)} />
      </div>
    )
  }

  const sharedInputClass = (hasError: boolean) =>
    `h-[52px] w-full rounded-xl border bg-transparent pl-11 pr-4 text-[15px] outline-none
    placeholder:text-slate-400 text-slate-800
    transition-all duration-200
    ${
      hasError
        ? 'border-red-400 focus:border-red-400'
        : 'border-slate-200 hover:border-slate-300 focus:border-[var(--color-auth-accent)] focus:ring-1 focus:ring-[var(--color-auth-accent)]/30'
    }`

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* 邮箱 */}
      <div>
        <label
          htmlFor="login-email"
          className="mb-2 block text-[13px] font-medium"
          style={{ color: 'var(--color-auth-text-secondary)' }}
        >
          邮箱地址
        </label>
        <div className="relative">
          <Mail
            className="absolute left-4 top-1/2 -translate-y-1/2 size-[18px] pointer-events-none"
            style={{ color: 'var(--color-auth-text-tertiary)' }}
          />
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => handleChange('email', e.target.value)}
            onBlur={() => handleBlur('email')}
            placeholder="请输入邮箱地址"
            required
            autoComplete="email"
            className={sharedInputClass(touched.email && !!emailError)}
            style={{ backgroundColor: 'var(--color-auth-input-bg)' }}
          />
        </div>
        {touched.email && emailError && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle className="size-3.5 shrink-0" />
            {emailError}
          </p>
        )}
      </div>

      {/* 密码 */}
      <div>
        <label
          htmlFor="login-password"
          className="mb-2 block text-[13px] font-medium"
          style={{ color: 'var(--color-auth-text-secondary)' }}
        >
          密码
        </label>
        <div className="relative">
          <Lock
            className="absolute left-4 top-1/2 -translate-y-1/2 size-[18px] pointer-events-none"
            style={{ color: 'var(--color-auth-text-tertiary)' }}
          />
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => handleChange('password', e.target.value)}
            onBlur={() => handleBlur('password')}
            placeholder="请输入密码"
            required
            autoComplete="current-password"
            className={`${sharedInputClass(touched.password && !!passwordError)} pr-12`}
            style={{ backgroundColor: 'var(--color-auth-input-bg)' }}
          />
          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors hover:opacity-70"
            style={{ color: 'var(--color-auth-text-tertiary)' }}
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </div>
        {touched.password && passwordError && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle className="size-3.5 shrink-0" />
            {passwordError}
          </p>
        )}
      </div>

      {/* 验证码 — 全宽 */}
      <div>
        <label
          className="mb-2 block text-[13px] font-medium"
          style={{ color: 'var(--color-auth-text-secondary)' }}
        >
          验证码
        </label>
        <Captcha
          onVerify={handleCaptchaVerify}
          onChallengeChange={handleCaptchaChallengeChange}
          onInput={handleCaptchaInput}
        />
      </div>

      {/* 记住我 & 忘记密码 — 同行 */}
      <div className="flex items-center justify-between">
        <label
          htmlFor="login-remember"
          className="flex items-center gap-2 cursor-pointer select-none group"
        >
          <Checkbox
            id="login-remember"
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked === true)}
          />
          <span
            className="text-[13px] group-hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-auth-text-secondary)' }}
          >
            记住我
          </span>
        </label>
        <button
          type="button"
          onClick={() => setShowForgotPassword(true)}
          className="text-[13px] font-medium transition-colors hover:opacity-70"
          style={{ color: 'var(--color-auth-accent)' }}
        >
          忘记密码？
        </button>
      </div>

      {/* 全局错误提示 */}
      {error && (
        <div
          className="flex items-start gap-2.5 rounded-xl p-3.5 text-sm"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.06)', color: '#dc2626' }}
        >
          <ShieldAlert className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* 登录按钮 */}
      <button
        type="submit"
        disabled={loading}
        className="relative h-[52px] w-full rounded-xl text-[15px] font-semibold transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          enabled:hover:shadow-lg enabled:hover:shadow-[var(--color-auth-accent)]/25 enabled:active:scale-[0.98]"
        style={{
          background: 'linear-gradient(135deg, #5074fa 0%, #6c8aff 100%)',
          color: '#ffffff',
        }}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            登录中...
          </span>
        ) : (
          '登录'
        )}
      </button>
    </form>
  )
}
