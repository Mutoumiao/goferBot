import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { getCaptcha } from '@/api/auth'

interface CaptchaChallenge {
  captchaId: string
  imageBase64: string
}

interface CaptchaProps {
  onVerify: (valid: boolean) => void
  onChallengeChange?: (challenge: CaptchaChallenge | null) => void
  onInput?: (value: string) => void
  className?: string
}

export function Captcha({ onVerify, onChallengeChange, onInput, className = '' }: CaptchaProps) {
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null)
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const [verified, setVerified] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchChallenge = useCallback(async () => {
    setLoading(true)
    setError(false)
    setVerified(false)
    onVerify(false)
    try {
      const data = await getCaptcha().send()
      setChallenge({
        captchaId: data.captchaId,
        imageBase64: data.imageBase64,
      })
      setInput('')
      onChallengeChange?.({ captchaId: data.captchaId, imageBase64: data.imageBase64 })
    } catch {
      setError(true)
      setChallenge(null)
      onChallengeChange?.(null)
    } finally {
      setLoading(false)
    }
  }, [onVerify, onChallengeChange])

  useEffect(() => {
    void fetchChallenge()
  }, [fetchChallenge])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await fetchChallenge()
    setRefreshing(false)
  }, [fetchChallenge])

  const handleChange = (value: string) => {
    if (!challenge) return
    const upper = value.toUpperCase()
    setInput(upper)
    setError(false)
    onInput?.(upper)
    // 仅在长度达到 4 位时做前端"已输入"状态；真正的校验由后端完成
    if (upper.length === 4) {
      setVerified(true)
      onVerify(true)
    } else {
      setVerified(false)
      onVerify(false)
    }
  }

  const imageSrc = challenge ? `data:image/png;base64,${challenge.imageBase64}` : ''

  return (
    <div className={`flex gap-2 ${className}`}>
      <input
        type="text"
        inputMode="text"
        maxLength={4}
        value={input}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="验证码"
        className={`flex-1 h-[52px] rounded-xl border px-4 text-[15px] outline-none transition-all duration-200 bg-transparent text-center tracking-widest
          ${
            verified
              ? 'border-green-400 text-green-600 placeholder:text-green-300'
              : error
                ? 'border-red-400 text-red-500 placeholder:text-red-300'
                : 'border-slate-200 text-slate-700 placeholder:text-slate-400 hover:border-slate-300 focus:border-[var(--color-auth-accent)] focus:ring-1 focus:ring-[var(--color-auth-accent)]/30'
          }`}
        style={{ backgroundColor: 'var(--color-auth-input-bg)' }}
      />
      <div
        className="relative shrink-0 cursor-pointer overflow-hidden rounded-xl"
        style={{ width: 130, height: 52 }}
      >
        {refreshing || loading ? (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ backgroundColor: 'var(--color-auth-input-bg)' }}
          >
            <RefreshCw
              className="size-5 animate-spin"
              style={{ color: 'var(--color-auth-text-tertiary)' }}
            />
          </div>
        ) : imageSrc ? (
          <img
            src={imageSrc}
            alt="验证码"
            width={130}
            height={52}
            className="block h-full w-full"
            draggable={false}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-xs"
            style={{
              backgroundColor: 'var(--color-auth-input-bg)',
              color: 'var(--color-auth-text-tertiary)',
            }}
          >
            加载失败
          </div>
        )}
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing || loading}
          className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-200 hover:bg-black/5 opacity-0 hover:opacity-100 disabled:opacity-0"
          title="点击刷新验证码"
        >
          <RefreshCw className="size-5 text-slate-600" />
        </button>
      </div>
    </div>
  )
}

export type { CaptchaChallenge }
