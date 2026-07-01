import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockUseAuthStore } = vi.hoisted(() => ({
  mockUseAuthStore: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: mockUseAuthStore,
}))

import { useMenuConfig } from '@/components/layout/MenuConfig'

function selectUser(role: 'ADMIN' | 'USER' | null) {
  const permissions =
    role === 'ADMIN'
      ? [
          'dashboard',
          'users',
          'roles',
          'rag',
          'sessions',
          'audit',
          'modelProviders',
          'moduleSettings',
        ]
      : role === 'USER'
        ? ['dashboard']
        : []
  return (
    selector: (s: {
      user: {
        role: string
        id: string
        email: string
        isActive: boolean
        permissions?: string[]
      } | null
    }) => unknown,
  ) =>
    selector({
      user: role ? { role, id: '1', email: 'a@b.com', isActive: true, permissions } : null,
    })
}

describe('MenuConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters menu by ADMIN role', () => {
    mockUseAuthStore.mockImplementation(selectUser('ADMIN'))
    const { result } = renderHook(() => useMenuConfig())
    const keys = result.current.map((m) => m.key)
    expect(keys).toContain('dashboard')
    expect(keys).toContain('users')
    expect(keys).toContain('roles')
    expect(keys).toContain('modelProviders')
    expect(keys).toContain('moduleSettings')
    expect(keys).toContain('audit')
    expect(keys).not.toContain('login')
    expect(keys).not.toContain('userDetail')
  })

  it('filters menu by USER role (limited access)', () => {
    mockUseAuthStore.mockImplementation(selectUser('USER'))
    const { result } = renderHook(() => useMenuConfig())
    const keys = result.current.map((m) => m.key)
    expect(keys).toContain('dashboard')
    expect(keys).not.toContain('users')
    expect(keys).not.toContain('roles')
    expect(keys).not.toContain('modelProviders')
    expect(keys).not.toContain('moduleSettings')
    expect(keys).not.toContain('audit')
  })

  it('returns empty menu when user is null', () => {
    mockUseAuthStore.mockImplementation(selectUser(null))
    const { result } = renderHook(() => useMenuConfig())
    const keys = result.current.map((m) => m.key)
    expect(keys).toEqual([])
  })

  it('returns stable count on re-render', () => {
    mockUseAuthStore.mockImplementation(selectUser('ADMIN'))
    const { result, rerender } = renderHook(() => useMenuConfig())
    const firstLen = result.current.length
    act(() => {
      rerender()
    })
    expect(result.current.length).toBe(firstLen)
  })
})
