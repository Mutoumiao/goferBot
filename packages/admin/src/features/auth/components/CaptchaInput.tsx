import { Input, Spin } from 'antd'
import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { type CaptchaResponse, getCaptcha } from '@/api/auth'

interface CaptchaInputProps {
  value: string
  onChange: (value: string) => void
  onChallengeChange?: (challenge: CaptchaResponse | null) => void
  status?: 'error' | undefined
}

export function CaptchaInput({ value, onChange, onChallengeChange, status }: CaptchaInputProps) {
  const [challenge, setChallenge] = useState<CaptchaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchChallenge = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCaptcha().send()
      setChallenge(data)
      onChallengeChange?.(data)
    } catch {
      setChallenge(null)
      onChallengeChange?.(null)
    } finally {
      setLoading(false)
    }
  }, [onChallengeChange])

  useEffect(() => {
    void fetchChallenge()
  }, [fetchChallenge])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchChallenge()
    setRefreshing(false)
  }

  const imageSrc = challenge ? `data:image/png;base64,${challenge.imageBase64}` : ''

  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="请输入验证码"
        maxLength={4}
        status={status}
        size="large"
        className="flex-1 uppercase tracking-widest"
      />
      <div
        className="relative flex-shrink-0 cursor-pointer overflow-hidden rounded-md"
        style={{ width: 120, height: 40 }}
      >
        {refreshing || loading ? (
          <div className="flex h-full w-full items-center justify-center bg-gray-100">
            <Spin size="small" />
          </div>
        ) : imageSrc ? (
          <img
            src={imageSrc}
            alt="验证码"
            width={120}
            height={40}
            className="block h-full w-full"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs text-gray-400">
            加载失败
          </div>
        )}
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity hover:bg-black/10 hover:opacity-100 disabled:opacity-0"
          title="刷新验证码"
        >
          <RefreshCw size={16} className="text-gray-700" />
        </button>
      </div>
    </div>
  )
}
