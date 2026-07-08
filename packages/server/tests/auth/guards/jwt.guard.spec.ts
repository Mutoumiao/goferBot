import { UnauthorizedException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { JwtAuthGuard } from '@/auth/guards/jwt.guard.js'

vi.mock('@/auth/strategies/jwt.strategy.js', () => ({
  getAppForRequest: () => 'web',
}))

function createMockContext(cookies: Record<string, string | undefined> = {}) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ cookies }),
      getResponse: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
    getType: () => 'http',
    switchToRpc: () => ({}),
    switchToWs: () => ({}),
  } as any
}

describe('JwtAuthGuard', () => {
  it('handleRequest throws NO_AUTH_TOKEN when cookie is missing', () => {
    const guard = new JwtAuthGuard()
    const ctx = createMockContext({})
    try {
      guard.handleRequest(null, false, undefined, ctx)
      expect.unreachable('Expected error to be thrown')
    } catch (e: any) {
      expect(e.code).toBe('NO_AUTH_TOKEN')
      expect(e.getStatus()).toBe(401)
    }
  })

  it('handleRequest throws UnauthorizedException when cookie present but user is false', () => {
    const guard = new JwtAuthGuard()
    const ctx = createMockContext({ goferbot_web_access_token: 'fake-token' })
    expect(() => guard.handleRequest(null, false, undefined, ctx)).toThrow(UnauthorizedException)
  })

  it('handleRequest throws error when cookie present and error is provided', () => {
    const guard = new JwtAuthGuard()
    const ctx = createMockContext({ goferbot_web_access_token: 'fake-token' })
    const err = new Error('custom')
    expect(() => guard.handleRequest(err, false, undefined, ctx)).toThrow(err)
  })

  it('handleRequest returns user when cookie present and user is valid', () => {
    const guard = new JwtAuthGuard()
    const ctx = createMockContext({ goferbot_web_access_token: 'fake-token' })
    const user = { id: '1' }
    expect(guard.handleRequest(null, user, undefined, ctx)).toBe(user)
  })
})
