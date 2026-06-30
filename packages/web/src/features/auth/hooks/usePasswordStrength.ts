import { useCallback, useState } from 'react'

interface PasswordStrengthResult {
  score: number
  label: string
  color: string
}

function evaluatePassword(password: string): PasswordStrengthResult {
  if (!password) {
    return { score: 0, label: '', color: 'bg-border-default' }
  }

  let score = 0

  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z\d]/.test(password)) score++

  const levels: PasswordStrengthResult[] = [
    { score: 0, label: '', color: 'bg-border-default' },
    { score: 1, label: '弱', color: 'bg-destructive' },
    { score: 2, label: '较弱', color: 'bg-orange-500' },
    { score: 3, label: '中等', color: 'bg-yellow-500' },
    { score: 4, label: '强', color: 'bg-green-400' },
    { score: 5, label: '非常强', color: 'bg-green-500' },
  ]

  return levels[Math.min(score, 5)]!
}

interface UsePasswordStrengthOptions {
  onStrengthChange?: (result: PasswordStrengthResult) => void
}

export function usePasswordStrength(options?: UsePasswordStrengthOptions) {
  const [strength, setStrength] = useState<PasswordStrengthResult>({
    score: 0,
    label: '',
    color: 'bg-border-default',
  })

  const evaluate = useCallback(
    (password: string) => {
      const result = evaluatePassword(password)
      setStrength(result)
      options?.onStrengthChange?.(result)
      return result
    },
    [options],
  )

  return { strength, evaluate }
}
