import { ArrowLeft, Loader2, Mail } from 'lucide-react'
import { useState } from 'react'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface ForgotPasswordProps {
  onBack: () => void
}

type Step = 'email' | 'sent'

const inputClass = `
  h-[52px] w-full rounded-xl border bg-transparent px-4 text-[15px]
  placeholder:text-slate-400 text-slate-800
  transition-all duration-200 outline-none
  border-slate-200 hover:border-slate-300
  focus:border-[var(--color-auth-accent)] focus:ring-1 focus:ring-[var(--color-auth-accent)]/30
`
  .replace(/\s+/g, ' ')
  .trim()

export function ForgotPassword({ onBack }: ForgotPasswordProps) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const validate = (): boolean => {
    setEmailError(null)
    if (!email.trim()) {
      setEmailError('请输入邮箱地址')
      return false
    }
    if (!EMAIL_REGEX.test(email)) {
      setEmailError('请输入有效的邮箱地址')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    // ponytail: 当前后端暂无密码重置接口，模拟发送流程
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setLoading(false)
    setStep('sent')
  }

  if (step === 'sent') {
    return (
      <div className="text-center">
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--color-auth-accent-soft)' }}
        >
          <Mail className="size-7" style={{ color: 'var(--color-auth-accent)' }} />
        </div>
        <h3 className="text-xl font-bold" style={{ color: 'var(--color-auth-text-primary)' }}>
          邮件已发送
        </h3>
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: 'var(--color-auth-text-secondary)' }}
        >
          我们已向{' '}
          <span style={{ color: 'var(--color-auth-text-primary)' }} className="font-medium">
            {email}
          </span>{' '}
          发送了一封密码重置邮件，请查收并按照邮件中的指引完成密码重置。
        </p>
        <p className="mt-3 text-xs" style={{ color: 'var(--color-auth-text-tertiary)' }}>
          未收到邮件？请检查垃圾邮件文件夹，或
          <button
            type="button"
            onClick={() => setStep('email')}
            className="ml-1 font-medium hover:underline"
            style={{ color: 'var(--color-auth-accent)' }}
          >
            重新发送
          </button>
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 w-full h-[52px] rounded-xl text-sm font-medium transition-all duration-200 hover:shadow-sm flex items-center justify-center gap-2"
          style={{
            backgroundColor: 'var(--color-auth-input-bg)',
            border: '1px solid var(--color-auth-input-border)',
            color: 'var(--color-auth-text-primary)',
          }}
        >
          <ArrowLeft className="size-4" />
          返回登录
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-70"
        style={{ color: 'var(--color-auth-text-secondary)' }}
      >
        <ArrowLeft className="size-4" />
        返回登录
      </button>

      <div className="mb-6">
        <h3 className="text-xl font-bold" style={{ color: 'var(--color-auth-text-primary)' }}>
          找回密码
        </h3>
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{ color: 'var(--color-auth-text-secondary)' }}
        >
          请输入您的注册邮箱，我们将向您发送密码重置链接
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="forgot-email"
            className="mb-2 block text-[13px] font-medium"
            style={{ color: 'var(--color-auth-text-secondary)' }}
          >
            注册邮箱
          </label>
          <input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (emailError) setEmailError(null)
            }}
            placeholder="请输入注册时使用的邮箱"
            required
            className={inputClass}
            style={{ backgroundColor: 'var(--color-auth-input-bg)' }}
          />
          {emailError && <p className="mt-1.5 text-xs text-red-500">{emailError}</p>}
        </div>

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
              发送中...
            </span>
          ) : (
            '发送重置邮件'
          )}
        </button>
      </form>
    </div>
  )
}
