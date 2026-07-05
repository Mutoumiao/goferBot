import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { JwtAuthGuard } from '@/auth/guards/jwt.guard.js'

describe('JwtAuthGuard', () => {
  function createMockContext(user: unknown): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => user,
        getResponse: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
      getType: () => 'http',
      switchToRpc: () => ({}),
      switchToWs: () => ({}),
    } as unknown as ExecutionContext
  }

  it('handleRequest throws UnauthorizedException when user is false', () => {
    const guard = new JwtAuthGuard()
    expect(() => guard.handleRequest(null, false)).toThrow(UnauthorizedException)
  })

  it('handleRequest throws error when error is provided', () => {
    const guard = new JwtAuthGuard()
    const err = new Error('custom')
    expect(() => guard.handleRequest(err, false)).toThrow(err)
  })

  it('handleRequest returns user when valid', () => {
    const guard = new JwtAuthGuard()
    const user = { id: '1' }
    expect(guard.handleRequest(null, user)).toBe(user)
  })
})
