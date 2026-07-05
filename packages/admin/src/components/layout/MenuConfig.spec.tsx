import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockUseAuthStore } = vi.hoisted(() => ({
  mockUseAuthStore: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: mockUseAuthStore,
}))

import { useMenuConfig } from '@/components/layout/MenuConfig'

type TestUser = {
  roles: string[]
  id: string
  email: string
  isActive: boolean
  permissions?: string[]
}

function selectUser(roles: string[] | null, permissions?: string[]) {
  const defaultPermissions = roles?.includes('super_admin')
    ? []
    : roles?.includes('admin')
      ? [
          'dashboard:read',
          'users:read',
          'roles:read',
          'audit:read',
          'invitations:read',
          'settings:read',
        ]
      : roles?.includes('user')
        ? ['dashboard:read']
        : []
  return (selector: (s: { user: TestUser | null }) => unknown) =>
    selector({
      user: roles
        ? {
            roles,
            id: '1',
            email: 'a@b.com',
            isActive: true,
            permissions: permissions ?? defaultPermissions,
          }
        : null,
    })
}

describe('MenuConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows all menus for super_admin role', () => {
    mockUseAuthStore.mockImplementation(selectUser(['super_admin']))
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

  it('filters menu by admin role with permissions', () => {
    mockUseAuthStore.mockImplementation(selectUser(['admin']))
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

  it('filters menu by user role (limited access)', () => {
    mockUseAuthStore.mockImplementation(selectUser(['user']))
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
    mockUseAuthStore.mockImplementation(selectUser(['admin']))
    const { result, rerender } = renderHook(() => useMenuConfig())
    const firstLen = result.current.length
    act(() => {
      rerender()
    })
    expect(result.current.length).toBe(firstLen)
  })
})
