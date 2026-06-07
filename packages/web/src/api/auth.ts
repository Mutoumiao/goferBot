import type { LoginRequest, RegisterRequest, AuthResponse, User } from '@goferbot/data'
import { alovaInstance } from '@/utils/server'

/**
 * 登录 — 返回 accessToken + user
 */
export const login = (data: LoginRequest) =>
  alovaInstance.Post<AuthResponse>('/auth/login', data)

/**
 * 注册 — 返回 accessToken + user
 */
export const register = (data: RegisterRequest) =>
  alovaInstance.Post<AuthResponse>('/auth/register', data)

/**
 * 获取当前用户信息（需 Bearer Token）
 */
export const getMe = () =>
  alovaInstance.Get<User>('/auth/me')

/**
 * Token 刷新 — 由 alova 拦截器自动调用，一般不直接使用
 */
export const refresh = () =>
  alovaInstance.Post<AuthResponse>('/auth/refresh')
