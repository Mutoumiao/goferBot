import type { MiddlewareHandler } from 'hono'
import type { ConflictError, ValidationError, AuthError } from './errors.js'

/** 注册凭证 */
export interface SignUpCredentials {
  email: string
  password: string
  name?: string
}

/** 登录凭证 */
export interface SignInCredentials {
  email: string
  password: string
}

/** 用户对象 */
export interface User {
  id: string
  email: string
  name: string | null
  avatar: string | null
  createdAt: Date
}

/** 会话对象 */
export interface Session {
  id: string
  userId: string
  expiresAt: Date
}

/** 认证结果 */
export interface AuthResult {
  user: User
  session: Session
}

/**
 * 认证抽象，支持邮箱密码登录、会话管理与 Hono 中间件集成。
 */
export interface IAuthProvider {
  /**
   * 用户注册。
   * @param credentials — 注册信息
   * @returns 创建的用户对象（不含密码）与初始会话
   * @throws ConflictError — 邮箱已注册
   * @throws ValidationError — 密码强度不足或格式非法
   */
  signUp(credentials: SignUpCredentials): Promise<AuthResult>

  /**
   * 用户登录。
   * @param credentials — 登录信息
   * @returns 用户对象与新会话
   * @throws AuthError — 邮箱或密码错误
   */
  signIn(credentials: SignInCredentials): Promise<AuthResult>

  /**
   * 用户登出，销毁当前会话。
   * @param request — 当前 HTTP 请求（用于读取 Cookie/Token）
   * @returns void
   */
  signOut(request: Request): Promise<void>

  /**
   * 获取当前会话信息。
   * @param request — 当前 HTTP 请求
   * @returns 会话对象；未登录时返回 null（不抛异常）
   */
  getSession(request: Request): Promise<Session | null>

  /**
   * 返回 Hono 中间件，用于保护路由。
   * 中间件内部调用 getSession，未登录时返回 401。
   * @returns Hono MiddlewareHandler
   */
  middleware(): MiddlewareHandler
}
