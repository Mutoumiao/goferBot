import { describe, it, expect } from 'vitest'
import { cn } from '@/utils/cn'

describe('cn utility', () => {
  it('merges class strings', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('filters falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b')
  })

  it('resolves Tailwind conflicts via twMerge', () => {
    // p-4 and p-2 conflict; twMerge keeps the last one
    const result = cn('p-4 text-red-500', 'p-2')
    expect(result).toContain('p-2')
    expect(result).not.toContain('p-4')
  })

  it('handles conditional classes', () => {
    const isActive = true
    const result = cn('base', isActive && 'active')
    expect(result).toBe('base active')
  })
})
