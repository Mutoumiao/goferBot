import { auth } from '../auth.js'
import {
  type IAuthProvider,
  type SignUpCredentials,
  type SignInCredentials,
  type AuthResult,
  type Session,
} from '../interfaces/IAuthProvider.js'
import { ConflictError, ValidationError, AuthError } from '../interfaces/errors.js'
import type { MiddlewareHandler } from 'hono'

function toUser(betterUser: Record<string, unknown>) {
  return {
    id: String(betterUser.id),
    email: String(betterUser.email),
    name: betterUser.name ? String(betterUser.name) : null,
    avatar: betterUser.avatar ? String(betterUser.avatar) : null,
    createdAt: new Date(String(betterUser.createdAt)),
  }
}

function toSession(betterSession: Record<string, unknown>): Session {
  return {
    id: String(betterSession.id),
    userId: String(betterSession.userId),
    expiresAt: new Date(String(betterSession.expiresAt)),
  }
}

export class BetterAuthProvider implements IAuthProvider {
  async signUp(credentials: SignUpCredentials): Promise<AuthResult> {
    try {
      const result = await auth.api.signUpEmail({
        body: {
          email: credentials.email,
          password: credentials.password,
          name: credentials.name ?? '',
        },
      })

      const resultAny = result as Record<string, unknown>
      if (!resultAny || !resultAny.user || !resultAny.session) {
        throw new AuthError('Registration failed')
      }

      return {
        user: toUser(resultAny.user as Record<string, unknown>),
        session: toSession(resultAny.session as Record<string, unknown>),
      }
    } catch (err: any) {
      if (err?.statusCode === 400 && err?.message?.toLowerCase().includes('password')) {
        throw new ValidationError('Password must be at least 8 characters')
      }
      if (err?.statusCode === 409 || err?.message?.toLowerCase().includes('already exists')) {
        throw new ConflictError('Email already registered')
      }
      if (err instanceof ConflictError || err instanceof ValidationError) {
        throw err
      }
      throw new AuthError('Registration failed')
    }
  }

  async signIn(credentials: SignInCredentials): Promise<AuthResult> {
    try {
      const result = await auth.api.signInEmail({
        body: {
          email: credentials.email,
          password: credentials.password,
        },
      })

      const resultAny = result as Record<string, unknown>
      if (!resultAny || !resultAny.user || !resultAny.session) {
        throw new AuthError('Invalid email or password')
      }

      return {
        user: toUser(resultAny.user as Record<string, unknown>),
        session: toSession(resultAny.session as Record<string, unknown>),
      }
    } catch (err: any) {
      if (err instanceof AuthError) throw err
      throw new AuthError('Invalid email or password')
    }
  }

  async signOut(request: Request): Promise<void> {
    try {
      await auth.api.signOut({
        headers: request.headers,
      })
    } catch {
      // 幂等：即使 session 无效也静默成功
    }
  }

  async getSession(request: Request): Promise<Session | null> {
    try {
      const result = await auth.api.getSession({
        headers: request.headers,
      })
      if (!result || !result.session) return null
      return toSession(result.session as Record<string, unknown>)
    } catch {
      return null
    }
  }

  middleware(): MiddlewareHandler {
    return async (c, next) => {
      const session = await this.getSession(c.req.raw)
      if (!session) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
      // 注入 context（后续 handler 通过 c.get('user') / c.get('session') 读取）
      c.set('session', session)
      // user 需要额外查询，这里先注入 session；若需要 user 可在中间件内再查
      await next()
    }
  }
}
