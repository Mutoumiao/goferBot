import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JwtAuthGuard } from '@/auth/guards/jwt.guard.js'

describe('AC-05: JwtAuthGuard blacklist check', () => {
  let guard: JwtAuthGuard
  let mockAuthRedis: any

  beforeEach(() => {
    mockAuthRedis = {
      isTokenBlacklisted: vi.fn().mockResolvedValue(false),
    }
    guard = new JwtAuthGuard(mockAuthRedis)
  })

  function createMockContext(request: Record<string, any>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
      getType: () => 'http',
      switchToRpc: () => ({}),
      switchToWs: () => ({}),
    } as unknown as ExecutionContext
  }

  it('should throw UnauthorizedException when cookie token is blacklisted', async () => {
    mockAuthRedis.isTokenBlacklisted.mockResolvedValue(true)
    const context = createMockContext({
      headers: {},
      cookies: { goferbot_access_token: 'blacklisted-token' },
    })

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException)
    expect(mockAuthRedis.isTokenBlacklisted).toHaveBeenCalledWith('blacklisted-token')
  })
})