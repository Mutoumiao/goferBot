/**
 * NO_AUTH_TOKEN 功能验证脚本
 * 验证：guard cookie 检测 + strategy app-aware 提取 + 错误码正确性
 */
import { AppException } from '@/lib/app-error.js'
import { describe, expect, it, vi } from 'vitest'
import { JwtAuthGuard } from '@/auth/guards/jwt.guard.js'

vi.mock('@/auth/strategies/jwt.strategy.js', () => ({
  getAppForRequest: (req: any) => {
    // 模拟 admin path 路由
    if (req._app) return req._app
    return 'web'
  },
}))

function createMockContext(cookies: Record<string, string | undefined> = {}, app?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ cookies, _app: app }),
      getResponse: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
    getType: () => 'http',
    switchToRpc: () => ({}),
    switchToWs: () => ({}),
  } as any
}

describe('NO_AUTH_TOKEN 功能验证', () => {
  // ─── 场景 1: Server 端无 cookie → NO_AUTH_TOKEN ───
  describe('场景 1: 无 Cookie 返回 NO_AUTH_TOKEN', () => {
    it('无任何 cookie 时应返回 code=NO_AUTH_TOKEN, status=401', () => {
      const guard = new JwtAuthGuard()
      const ctx = createMockContext({})
      try {
        guard.handleRequest(null, false, undefined, ctx)
        expect.unreachable('Expected NO_AUTH_TOKEN error')
      } catch (e: any) {
        expect(e).toBeInstanceOf(AppException)
        expect(e.code).toBe('NO_AUTH_TOKEN')
        expect(e.getStatus()).toBe(401)
      }
    })

    it('cookie 对象为 undefined 时应返回 NO_AUTH_TOKEN', () => {
      const guard = new JwtAuthGuard()
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({}),
          getResponse: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
        getType: () => 'http',
        switchToRpc: () => ({}),
        switchToWs: () => ({}),
      } as any
      try {
        guard.handleRequest(null, false, undefined, ctx)
        expect.unreachable('Expected NO_AUTH_TOKEN error')
      } catch (e: any) {
        expect(e.code).toBe('NO_AUTH_TOKEN')
      }
    })
  })

  // ─── 场景 2: App-aware cookie 区分 ───
  describe('场景 2: App-aware cookie 区分', () => {
    it('web context 下仅检查 web cookie（admin cookie 无效）', () => {
      const guard = new JwtAuthGuard()
      const ctx = createMockContext(
        { goferbot_admin_access_token: 'admin-token' }, // 仅有 admin cookie
        'web',
      )
      try {
        guard.handleRequest(null, false, undefined, ctx)
        expect.unreachable(
          'Expected NO_AUTH_TOKEN — admin cookie should not be used in web context',
        )
      } catch (e: any) {
        expect(e.code).toBe('NO_AUTH_TOKEN')
      }
    })

    it('admin context 下仅检查 admin cookie（web cookie 无效）', () => {
      const guard = new JwtAuthGuard()
      const ctx = createMockContext(
        { goferbot_web_access_token: 'web-token' }, // 仅有 web cookie
        'admin',
      )
      try {
        guard.handleRequest(null, false, undefined, ctx)
        expect.unreachable(
          'Expected NO_AUTH_TOKEN — web cookie should not be used in admin context',
        )
      } catch (e: any) {
        expect(e.code).toBe('NO_AUTH_TOKEN')
      }
    })

    it('web context 下有 web cookie 应进入 passport 验证', () => {
      const guard = new JwtAuthGuard()
      const ctx = createMockContext({ goferbot_web_access_token: 'web-token' }, 'web')
      // cookie 存在但 user=false → UnauthorizedException（不是 NO_AUTH_TOKEN）
      expect(() => guard.handleRequest(null, false, undefined, ctx)).toThrow()
      try {
        guard.handleRequest(null, false, undefined, ctx)
      } catch (e: any) {
        // 应该不是 AppException 的 NO_AUTH_TOKEN
        expect(e.code).toBeUndefined()
      }
    })

    it('admin context 下有 admin cookie 应进入 passport 验证', () => {
      const guard = new JwtAuthGuard()
      const ctx = createMockContext({ goferbot_admin_access_token: 'admin-token' }, 'admin')
      try {
        guard.handleRequest(null, false, undefined, ctx)
      } catch (e: any) {
        expect(e.code).toBeUndefined()
      }
    })
  })

  // ─── 场景 3: 有效 token 正常通过 ───
  describe('场景 3: 有效 token 正常通过', () => {
    it('cookie 存在 + user 有效 → 返回 user', () => {
      const guard = new JwtAuthGuard()
      const ctx = createMockContext({ goferbot_web_access_token: 'valid-token' }, 'web')
      const user = { id: 'user-1', email: 'test@example.com' }
      expect(guard.handleRequest(null, user, undefined, ctx)).toBe(user)
    })

    it('cookie 存在 + err=null + user 有效 → 返回 user', () => {
      const guard = new JwtAuthGuard()
      const ctx = createMockContext({ goferbot_web_access_token: 'valid-token' }, 'web')
      const user = { id: 'user-2' }
      expect(guard.handleRequest(null, user, undefined, ctx)).toBe(user)
    })

    it('admin context 有效 token → 返回 user', () => {
      const guard = new JwtAuthGuard()
      const ctx = createMockContext({ goferbot_admin_access_token: 'valid-token' }, 'admin')
      const user = { id: 'admin-user' }
      expect(guard.handleRequest(null, user, undefined, ctx)).toBe(user)
    })
  })

  // ─── 场景 4: Token 过期/无效 → 非 NO_AUTH_TOKEN ───
  describe('场景 4: Token 过期走现有 UnauthorizedException', () => {
    it('cookie 存在但 user=false → UnauthorizedException（非 NO_AUTH_TOKEN）', () => {
      const guard = new JwtAuthGuard()
      const ctx = createMockContext({ goferbot_web_access_token: 'expired-token' }, 'web')
      try {
        guard.handleRequest(null, false, undefined, ctx)
      } catch (e: any) {
        // 不应该是 AppException，且 code 不应是 NO_AUTH_TOKEN
        const code = (e as AppException).code
        expect(code).not.toBe('NO_AUTH_TOKEN')
      }
    })

    it('cookie 存在但 err 有值 → 抛出原始 error', () => {
      const guard = new JwtAuthGuard()
      const ctx = createMockContext({ goferbot_web_access_token: 'bad-token' }, 'web')
      const err = new Error('Token expired')
      try {
        guard.handleRequest(err, false, undefined, ctx)
      } catch (e: any) {
        expect(e.message).toBe('Token expired')
      }
    })
  })
})
