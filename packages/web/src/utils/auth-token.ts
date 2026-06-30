/**
 * 认证 token 工具函数（已迁移至 HttpOnly Cookie）
 *
 * ponytail: 安全说明
 * - 长期方案已落地：后端通过 HttpOnly + Secure + SameSite=Strict Cookie 下发 token
 * - 前端不再读取、存储、拼接 Authorization header
 * - 浏览器自动随请求携带 Cookie（alova 适配器需配置 credentials: 'include'）
 *
 * 本文件保留仅为兼容历史 import，所有函数均返回空值/不操作。
 */

/** @deprecated 已迁移至 HttpOnly Cookie，恒返回 null */
export function getAccessToken(): null {
  return null
}

/** @deprecated 已迁移至 HttpOnly Cookie，空操作 */
export function setAccessToken(_token: string): void {}

/** @deprecated 已迁移至 HttpOnly Cookie，恒返回 null */
export function getRefreshToken(): null {
  return null
}

/** @deprecated 已迁移至 HttpOnly Cookie，空操作 */
export function setRefreshToken(_token: string): void {}

/** @deprecated 已迁移至 HttpOnly Cookie，空操作 */
export function clearTokens(): void {}

/** @deprecated 已迁移至 HttpOnly Cookie，恒返回 null（浏览器自动携带 Cookie） */
export function buildAuthHeader(): null {
  return null
}
