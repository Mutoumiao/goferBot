import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/stores/auth'
import {
  buildLoginRedirectSearch,
  getAuthSnapshot,
  hasAnyPermission,
  hasPermission,
  isAdmin,
  waitForAuthInit,
} from '@/utils/auth-guard'

describe('auth-guard', () => {
  beforeEach(() => {
    useAuthStore.setState(
      {
        user: null,
        isAuthenticated: false,
        isInitialized: false,
        _hydrated: false,
        clearAuth: (() => undefined) as never,
        setUser: (() => undefined) as never,
        setInitialized: ((v: boolean) => useAuthStore.setState({ isInitialized: v })) as never,
        setMustChangePassword: (() => undefined) as never,
      },
      true,
    )
  })

  it('isAdmin requires ADMIN role and authenticated state', () => {
    expect(isAdmin({ isAuthenticated: true, role: 'ADMIN', permissions: [] })).toBe(true)
    expect(isAdmin({ isAuthenticated: true, role: 'USER', permissions: [] })).toBe(false)
    expect(isAdmin({ isAuthenticated: false, role: 'ADMIN', permissions: [] })).toBe(false)
  })

  it('getAuthSnapshot reads isAuthenticated, role and permissions', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: '1', role: 'ADMIN', email: 'a@b.com', permissions: ['dashboard', 'users'] },
    } as never)
    expect(getAuthSnapshot()).toEqual({
      isAuthenticated: true,
      role: 'ADMIN',
      permissions: ['dashboard', 'users'],
    })
  })

  it('hasPermission returns false for unauthenticated users', () => {
    expect(
      hasPermission({ isAuthenticated: false, role: 'ADMIN', permissions: ['users'] }, 'users'),
    ).toBe(false)
  })

  it('hasPermission returns true for SUPER_ADMIN regardless of permissions', () => {
    expect(
      hasPermission({ isAuthenticated: true, role: 'SUPER_ADMIN', permissions: [] }, 'users'),
    ).toBe(true)
  })

  it('hasPermission checks permission array for non-super-admin users', () => {
    expect(
      hasPermission(
        { isAuthenticated: true, role: 'ADMIN', permissions: ['dashboard', 'users'] },
        'users',
      ),
    ).toBe(true)
    expect(
      hasPermission({ isAuthenticated: true, role: 'ADMIN', permissions: ['dashboard'] }, 'users'),
    ).toBe(false)
  })

  it('hasAnyPermission returns false for unauthenticated users', () => {
    expect(
      hasAnyPermission({ isAuthenticated: false, role: 'ADMIN', permissions: ['users'] }, [
        'users',
        'roles',
      ]),
    ).toBe(false)
  })

  it('hasAnyPermission returns true for SUPER_ADMIN regardless of permissions', () => {
    expect(
      hasAnyPermission({ isAuthenticated: true, role: 'SUPER_ADMIN', permissions: [] }, [
        'users',
        'roles',
      ]),
    ).toBe(true)
  })

  it('hasAnyPermission checks if any permission is present', () => {
    expect(
      hasAnyPermission(
        { isAuthenticated: true, role: 'ADMIN', permissions: ['dashboard', 'users'] },
        ['users', 'roles'],
      ),
    ).toBe(true)
    expect(
      hasAnyPermission({ isAuthenticated: true, role: 'ADMIN', permissions: ['dashboard'] }, [
        'users',
        'roles',
      ]),
    ).toBe(false)
  })

  it('waitForAuthInit resolves immediately when hydrated', async () => {
    useAuthStore.setState({ _hydrated: true, isInitialized: true } as never)
    const result = await waitForAuthInit()
    expect(result).toBeUndefined()
  })

  it('waitForAuthInit times out and marks initialized', async () => {
    useAuthStore.setState({ _hydrated: false, isInitialized: false } as never)
    const start = Date.now()
    await waitForAuthInit(150)
    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(140)
    expect(useAuthStore.getState().isInitialized).toBe(true)
  }, 5000)

  it('buildLoginRedirectSearch 不会因 null 原型 search 对象崩溃（回归 #beforeLoad-crash）', () => {
    const nullProtoSearch = Object.assign(Object.create(null), { foo: 'bar' })
    const location = { href: '/dashboard?foo=bar', search: nullProtoSearch }

    expect(() => buildLoginRedirectSearch(location)).not.toThrow()
    expect(buildLoginRedirectSearch(location)).toEqual({ redirect: '/dashboard?foo=bar' })
  })

  it('buildLoginRedirectSearch 在登录页自身返回 undefined（避免回跳到 /login）', () => {
    expect(buildLoginRedirectSearch({ href: '/login' })).toBeUndefined()
  })
})
