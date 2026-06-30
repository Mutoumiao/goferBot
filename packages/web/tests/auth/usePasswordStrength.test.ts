import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePasswordStrength } from '@/features/auth/hooks/usePasswordStrength'

describe('usePasswordStrength', () => {
  it('returns empty state for empty password', () => {
    const { result } = renderHook(() => usePasswordStrength())
    expect(result.current.strength.score).toBe(0)
    expect(result.current.strength.label).toBe('')
  })

  it('returns "弱" for password with 8+ chars but no digits or mixed case', () => {
    const { result } = renderHook(() => usePasswordStrength())
    act(() => {
      result.current.evaluate('abcdefgh')
    })
    // 8+ chars = 1 point, no mixed case/numbers/special → score 1
    expect(result.current.strength.score).toBe(1)
    expect(result.current.strength.label).toBe('弱')
  })

  it('returns "较弱" for password with letters and numbers', () => {
    const { result } = renderHook(() => usePasswordStrength())
    act(() => {
      result.current.evaluate('abcdefg1')
    })
    // 8+ chars = 1, has digit = 1 → score 2
    expect(result.current.strength.score).toBe(2)
    expect(result.current.strength.label).toBe('较弱')
  })

  it('returns "强" for mixed case + numbers + length', () => {
    const { result } = renderHook(() => usePasswordStrength())
    act(() => {
      result.current.evaluate('Abcdefg12345')
    })
    // 12+ chars = 2, mixed case = 1, digits = 1 → score 4
    expect(result.current.strength.score).toBe(4)
    expect(result.current.strength.label).toBe('强')
  })

  it('returns "非常强" for password with special chars', () => {
    const { result } = renderHook(() => usePasswordStrength())
    act(() => {
      result.current.evaluate('Abcdefg12345!@#')
    })
    // 12+ chars = 2, mixed case = 1, digits = 1, special = 1 → score 5
    expect(result.current.strength.score).toBe(5)
    expect(result.current.strength.label).toBe('非常强')
  })

  it('calls onStrengthChange callback', () => {
    const calls: Array<{ label: string; score: number }> = []
    const { result } = renderHook(() =>
      usePasswordStrength({
        onStrengthChange: (r) => calls.push({ label: r.label, score: r.score }),
      }),
    )
    act(() => {
      result.current.evaluate('StrongPass1!')
    })
    expect(calls.length).toBe(1)
    expect(calls[0]!.score).toBe(5)
  })
})
