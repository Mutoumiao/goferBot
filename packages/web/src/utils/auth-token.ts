/**
 * 认证 token 工具函数
 * 集中管理 token 的读取，供 alovaInstance.beforeRequest 和 XRequest.authedFetch 共用
 *
 * ponytail: 安全说明
 * - 当前使用 localStorage 存储，存在 XSS 攻击风险
 * - 长期方案：后端支持 HttpOnly Cookie（推荐）
 * - 短期缓解：启用 CSP header 限制内联脚本
 */

/**
 * ponytail: 安全说明
 * 当前使用 localStorage 存储 Token，XSS 攻击可读取。
 *
 * 短期缓解措施：
 * 1. 确保 CSP (Content-Security-Policy) 正确配置
 * 2. 避免 XSS 漏洞：严格校验用户输入，使用 React 的自动转义
 *
 * 长期方案（需要后端配合）：
 * 1. 使用 HttpOnly Cookie 存储 Token
 * 2. 后端设置 SameSite=Strict/Lax
 * 3. 配合 CSRF Token 使用
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies
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
