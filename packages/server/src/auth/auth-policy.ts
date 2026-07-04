import type { AuthApp } from './types/auth-app.type.js'

export interface AuthAppPolicy {
  requireRolesToLogin: boolean
  includePermissionsInLoginResponse: boolean
  loginErrorCode: string
  loginErrorMessage: string
}

export const AUTH_APP_POLICIES: Record<AuthApp, AuthAppPolicy> = {
  web: {
    requireRolesToLogin: false,
    includePermissionsInLoginResponse: false,
    loginErrorCode: 'NO_WEB_ROLE',
    loginErrorMessage: '无权访问',
  },
  admin: {
    requireRolesToLogin: true,
    includePermissionsInLoginResponse: true,
    loginErrorCode: 'NO_ADMIN_ROLE',
    loginErrorMessage: '无权访问管理后台',
  },
}

export function getAuthPolicy(app: AuthApp): AuthAppPolicy {
  return AUTH_APP_POLICIES[app]
}
