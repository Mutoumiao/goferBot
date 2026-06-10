import { describe, it, expect, beforeEach } from 'vitest'
import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { RolesGuard } from '@/auth/guards/roles.guard.js'
import { Role } from '@/auth/enums/role.enum.js'

describe('AC-04: RolesGuard allows ADMIN and rejects USER', () => {
  let guard: RolesGuard
  let reflector: Reflector

  beforeEach(() => {
    reflector = new Reflector()
    guard = new RolesGuard(reflector)
  })

  function createMockContext(userRole: Role): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { role: userRole },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext
  }

  it('should allow access for ADMIN role', async () => {
    reflector.getAllAndOverride = () => [Role.ADMIN]
    const context = createMockContext(Role.ADMIN)

    await expect(guard.canActivate(context)).resolves.toBe(true)
  })

  it('should deny access for USER role when ADMIN required', async () => {
    reflector.getAllAndOverride = () => [Role.ADMIN]
    const context = createMockContext(Role.USER)

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException)
  })

  it('should allow access when no roles are required', async () => {
    reflector.getAllAndOverride = () => undefined
    const context = createMockContext(Role.USER)

    await expect(guard.canActivate(context)).resolves.toBe(true)
  })
})
