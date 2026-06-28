import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/stores/auth'
import {
  buildLoginRedirectSearch,
  getAuthSnapshot,
  isAdmin,
  waitForAuthInit,
} from '@/utils/auth-guard'

describe('auth-guard', () => {
  beforeEach(() => {
    useAuthStore.setState(
      {
        user: null,
        token: null,
        isAuthenticated: false,
        isInitialized: false,
        _hydrated: false,
        setAuth: (() => undefined) as never,
        clearAuth: (() => undefined) as never,
        setUser: (() => undefined) as never,
        setInitialized: ((v: boolean) => useAuthStore.setState({ isInitialized: v })) as never,
      },
      true,
    )
  })

  it('isAdmin requires ADMIN role and token', () => {
    expect(isAdmin({ token: 't', role: 'ADMIN' })).toBe(true)
    expect(isAdmin({ token: 't', role: 'USER' })).toBe(false)
    expect(isAdmin({ token: null, role: 'ADMIN' })).toBe(false)
  })

  it('getAuthSnapshot reads token and role', () => {
    useAuthStore.setState({
      token: 'tok',
      user: { id: '1', role: 'ADMIN', email: 'a@b.com' },
    } as never)
    expect(getAuthSnapshot()).toEqual({ token: 'tok', role: 'ADMIN' })
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
    // Arrange: 还原触发崩溃的真实场景——location 同时带 href 与 null 原型 search
    const nullProtoSearch = Object.assign(Object.create(null), { foo: 'bar' })
    const location = { href: '/dashboard?foo=bar', search: nullProtoSearch }

    // Act + Assert: 旧实现 `pathname + search` 会抛 TypeError，新实现用 href 不会
    expect(() => buildLoginRedirectSearch(location)).not.toThrow()
    expect(buildLoginRedirectSearch(location)).toEqual({ redirect: '/dashboard?foo=bar' })
  })

  it('buildLoginRedirectSearch 在登录页自身返回 undefined（避免回跳到 /login）', () => {
    expect(buildLoginRedirectSearch({ href: '/login' })).toBeUndefined()
  })
})
