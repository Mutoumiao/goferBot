/**
 * 认证 token 工具函数
 * 集中管理 token 的读取，供 alovaInstance.beforeRequest 和 XRequest.authedFetch 共用
 */

const ACCESS_TOKEN_KEY = 'goferbot_access_token'
const REFRESH_TOKEN_KEY = 'goferbot_refresh_token'

/** 获取访问令牌 */
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

/** 设置访问令牌 */
export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

/** 获取刷新令牌 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

/** 设置刷新令牌 */
export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

/** 清除所有令牌 */
export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

/** 构建 Authorization header 值 */
export function buildAuthHeader(): string | null {
  const token = getAccessToken()
  return token ? `Bearer ${token}` : null
}
