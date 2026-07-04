import { useNavigate } from '@tanstack/react-router'
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { validatePassword } from '@/utils/password'
import { usePasswordStrength } from '../hooks/usePasswordStrength'
import { registerUser } from '../services'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function RegisterForm() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [invitationCode, setInvitationCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [invitationCodeError, setInvitationCodeError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null)

  const { strength, evaluate } = usePasswordStrength()

  const validate = (): boolean => {
    let valid = true
    setNameError(null)
    setEmailError(null)
    setInvitationCodeError(null)
    setPasswordError(null)
    setConfirmPasswordError(null)

    if (!name.trim()) {
      setNameError('请输入用户名')
      valid = false
    }

    if (!email.trim()) {
      setEmailError('请输入邮箱地址')
      valid = false
    } else if (!EMAIL_REGEX.test(email)) {
      setEmailError('请输入有效的邮箱地址')
      valid = false
    }

    if (!invitationCode.trim()) {
      setInvitationCodeError('请输入邀请码')
      valid = false
    }

    const pwdErr = validatePassword(password)
    if (pwdErr) {
      setPasswordError(pwdErr)
      valid = false
    }

    if (!confirmPassword) {
      setConfirmPasswordError('请再次输入密码')
      valid = false
    } else if (confirmPassword !== password) {
      setConfirmPasswordError('两次输入的密码不一致')
      valid = false
    }

    return valid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validate()) return

    setLoading(true)
    const result = await registerUser(name, email, password, invitationCode)
    setLoading(false)
    if (result.success) {
      navigate({ to: '/', replace: true })
    } else {
      setError(result.error ?? '注册失败')
    }
  }

  const inputFieldClass = (hasError: boolean) =>
    `h-[52px] w-full rounded-xl border bg-transparent px-4 text-[15px]
    placeholder:text-slate-400 text-slate-800
    transition-all duration-200 outline-none
    ${
      hasError
        ? 'border-red-400 focus:border-red-400'
        : 'border-slate-200 hover:border-slate-300 focus:border-[var(--color-auth-accent)] focus:ring-1 focus:ring-[var(--color-auth-accent)]/30'
    }`

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* 用户名 */}
      <div>
        <label
          htmlFor="register-name"
          className="mb-2 block text-[13px] font-medium"
          style={{ color: 'var(--color-auth-text-secondary)' }}
        >
          用户名
        </label>
        <input
          id="register-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (nameError) setNameError(null)
          }}
          placeholder="你的名字"
          required
          className={inputFieldClass(!!nameError)}
          style={{ backgroundColor: 'var(--color-auth-input-bg)' }}
        />
        {nameError && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle className="size-3.5 shrink-0" />
            {nameError}
          </p>
        )}
      </div>

      {/* 邮箱 */}
      <div>
        <label
          htmlFor="register-email"
          className="mb-2 block text-[13px] font-medium"
          style={{ color: 'var(--color-auth-text-secondary)' }}
        >
          邮箱地址
        </label>
        <input
          id="register-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (emailError) setEmailError(null)
          }}
          placeholder="you@example.com"
          required
          className={inputFieldClass(!!emailError)}
          style={{ backgroundColor: 'var(--color-auth-input-bg)' }}
        />
        {emailError && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle className="size-3.5 shrink-0" />
            {emailError}
          </p>
        )}
      </div>

      {/* 邀请码 */}
      <div>
        <label
          htmlFor="register-invitation-code"
          className="mb-2 block text-[13px] font-medium"
          style={{ color: 'var(--color-auth-text-secondary)' }}
        >
          邀请码
        </label>
        <input
          id="register-invitation-code"
          type="text"
          value={invitationCode}
          onChange={(e) => {
            setInvitationCode(e.target.value)
            if (invitationCodeError) setInvitationCodeError(null)
          }}
          placeholder="请输入邀请码"
          required
          className={inputFieldClass(!!invitationCodeError)}
          style={{ backgroundColor: 'var(--color-auth-input-bg)' }}
        />
        {invitationCodeError && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle className="size-3.5 shrink-0" />
            {invitationCodeError}
          </p>
        )}
      </div>

      {/* 密码 */}
      <div>
        <label
          htmlFor="register-password"
          className="mb-2 block text-[13px] font-medium"
          style={{ color: 'var(--color-auth-text-secondary)' }}
        >
          密码
        </label>
        <div className="relative">
          <input
            id="register-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (passwordError) setPasswordError(null)
              evaluate(e.target.value)
            }}
            placeholder="请输入密码"
            required
            className={`${inputFieldClass(!!passwordError)} pr-12`}
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
        {/* 密码强度指示器 */}
        {password && (
          <div className="mt-2 flex items-center gap-2">
            <div
              className="flex-1 h-1 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--color-auth-divider)' }}
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                style={{ width: `${(strength.score / 5) * 100}%` }}
              />
            </div>
            {strength.label && (
              <span
                className="text-xs font-medium"
                style={{ color: 'var(--color-auth-text-tertiary)' }}
              >
                {strength.label}
              </span>
            )}
          </div>
        )}
        {passwordError && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle className="size-3.5 shrink-0" />
            {passwordError}
          </p>
        )}
      </div>

      {/* 确认密码 */}
      <div>
        <label
          htmlFor="register-confirm-password"
          className="mb-2 block text-[13px] font-medium"
          style={{ color: 'var(--color-auth-text-secondary)' }}
        >
          确认密码
        </label>
        <div className="relative">
          <input
            id="register-confirm-password"
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              if (confirmPasswordError) setConfirmPasswordError(null)
            }}
            placeholder="请再次输入密码"
            required
            className={`${inputFieldClass(!!confirmPasswordError)} pr-12`}
            style={{ backgroundColor: 'var(--color-auth-input-bg)' }}
          />
          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors hover:opacity-70"
            style={{ color: 'var(--color-auth-text-tertiary)' }}
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            tabIndex={-1}
          >
            {showConfirmPassword ? (
              <EyeOff className="size-[18px]" />
            ) : (
              <Eye className="size-[18px]" />
            )}
          </button>
        </div>
        {confirmPasswordError && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle className="size-3.5 shrink-0" />
            {confirmPasswordError}
          </p>
        )}
      </div>

      {/* 全局错误 */}
      {error && (
        <div
          className="flex items-start gap-2.5 rounded-xl p-3.5 text-sm"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.06)', color: '#dc2626' }}
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* 注册按钮 */}
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
            注册中...
          </span>
        ) : (
          '创建账户'
        )}
      </button>
    </form>
  )
}
