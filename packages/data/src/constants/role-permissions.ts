import { PERMISSIONS } from './permissions.js'

// 角色权限映射 — 与 seeder 完全对齐
// admin = 全部 21 个权限, user = 空数组（seeder 未给 user 分配任何权限）
export const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  super_admin: Object.values(PERMISSIONS),
  admin: Object.values(PERMISSIONS),
  user: [],
}
