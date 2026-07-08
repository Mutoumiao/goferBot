// 权限码常量 — 与后端 seeder (permission.seeder.ts) 完全对齐（共 21 个）
export const PERMISSIONS = {
  DASHBOARD_READ: 'dashboard:read',
  USERS_READ: 'users:read',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  USERS_RESET_PASSWORD: 'users:reset-password',
  ROLES_READ: 'roles:read',
  ROLES_CREATE: 'roles:create',
  ROLES_UPDATE: 'roles:update',
  ROLES_DELETE: 'roles:delete',
  INVITATIONS_READ: 'invitations:read',
  INVITATIONS_CREATE: 'invitations:create',
  INVITATIONS_UPDATE: 'invitations:update',
  INVITATIONS_DELETE: 'invitations:delete',
  AUDIT_READ: 'audit:read',
  AUDIT_EXPORT: 'audit:export',
  SETTINGS_READ: 'settings:read',
  SETTINGS_UPDATE: 'settings:update',
  SYSTEM_METRICS: 'system:metrics',
  SYSTEM_MAINTENANCE: 'system:maintenance',
  SYSTEM_LOGS: 'system:logs',
} as const

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const PERMISSION_GROUPS: {
  label: string
  permissions: PermissionCode[]
}[] = [
  { label: '仪表盘', permissions: [PERMISSIONS.DASHBOARD_READ] },
  {
    label: '用户管理',
    permissions: [
      PERMISSIONS.USERS_READ,
      PERMISSIONS.USERS_CREATE,
      PERMISSIONS.USERS_UPDATE,
      PERMISSIONS.USERS_DELETE,
      PERMISSIONS.USERS_RESET_PASSWORD,
    ],
  },
  {
    label: '角色管理',
    permissions: [
      PERMISSIONS.ROLES_READ,
      PERMISSIONS.ROLES_CREATE,
      PERMISSIONS.ROLES_UPDATE,
      PERMISSIONS.ROLES_DELETE,
    ],
  },
  {
    label: '邀请码管理',
    permissions: [
      PERMISSIONS.INVITATIONS_READ,
      PERMISSIONS.INVITATIONS_CREATE,
      PERMISSIONS.INVITATIONS_UPDATE,
      PERMISSIONS.INVITATIONS_DELETE,
    ],
  },
  {
    label: '审计日志',
    permissions: [PERMISSIONS.AUDIT_READ, PERMISSIONS.AUDIT_EXPORT],
  },
  {
    label: '系统配置',
    permissions: [PERMISSIONS.SETTINGS_READ, PERMISSIONS.SETTINGS_UPDATE],
  },
  {
    label: '系统运维',
    permissions: [
      PERMISSIONS.SYSTEM_METRICS,
      PERMISSIONS.SYSTEM_MAINTENANCE,
      PERMISSIONS.SYSTEM_LOGS,
    ],
  },
]
