export const PERMISSIONS = {
  DASHBOARD: 'dashboard',
  PROFILE: 'profile',

  USERS: 'users',
  USERS_READ: 'users:read',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',

  ROLES: 'roles',
  ROLES_READ: 'roles:read',
  ROLES_CREATE: 'roles:create',
  ROLES_UPDATE: 'roles:update',
  ROLES_DELETE: 'roles:delete',

  RAG: 'rag',
  SESSIONS: 'sessions',
  AUDIT: 'audit',
  MODEL_PROVIDERS: 'modelProviders',
  MODULE_SETTINGS: 'moduleSettings',
} as const

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const PERMISSION_GROUPS: {
  label: string
  permissions: PermissionCode[]
}[] = [
  {
    label: '仪表盘',
    permissions: [PERMISSIONS.DASHBOARD],
  },
  {
    label: '用户管理',
    permissions: [
      PERMISSIONS.USERS,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.USERS_CREATE,
      PERMISSIONS.USERS_UPDATE,
      PERMISSIONS.USERS_DELETE,
    ],
  },
  {
    label: '角色管理',
    permissions: [
      PERMISSIONS.ROLES,
      PERMISSIONS.ROLES_READ,
      PERMISSIONS.ROLES_CREATE,
      PERMISSIONS.ROLES_UPDATE,
      PERMISSIONS.ROLES_DELETE,
    ],
  },
  {
    label: 'RAG 观测',
    permissions: [PERMISSIONS.RAG],
  },
  {
    label: '会话观测',
    permissions: [PERMISSIONS.SESSIONS],
  },
  {
    label: '审计日志',
    permissions: [PERMISSIONS.AUDIT],
  },
  {
    label: '模型提供商',
    permissions: [PERMISSIONS.MODEL_PROVIDERS],
  },
  {
    label: '模块配置',
    permissions: [PERMISSIONS.MODULE_SETTINGS],
  },
  {
    label: '个人中心',
    permissions: [PERMISSIONS.PROFILE],
  },
]

export const ROLE_PERMISSIONS: Record<string, PermissionCode[]> = {
  SUPER_ADMIN: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.USERS,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_DELETE,
    PERMISSIONS.ROLES,
    PERMISSIONS.ROLES_READ,
    PERMISSIONS.ROLES_CREATE,
    PERMISSIONS.ROLES_UPDATE,
    PERMISSIONS.ROLES_DELETE,
    PERMISSIONS.RAG,
    PERMISSIONS.SESSIONS,
    PERMISSIONS.AUDIT,
    PERMISSIONS.PROFILE,
    PERMISSIONS.MODEL_PROVIDERS,
    PERMISSIONS.MODULE_SETTINGS,
  ],
  ADMIN: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.USERS,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.ROLES,
    PERMISSIONS.ROLES_READ,
    PERMISSIONS.RAG,
    PERMISSIONS.SESSIONS,
    PERMISSIONS.AUDIT,
    PERMISSIONS.PROFILE,
    PERMISSIONS.MODEL_PROVIDERS,
    PERMISSIONS.MODULE_SETTINGS,
  ],
  USER: [PERMISSIONS.DASHBOARD, PERMISSIONS.PROFILE],
}
