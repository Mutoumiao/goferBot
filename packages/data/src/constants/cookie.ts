export const WEB_ACCESS_COOKIE = 'goferbot_web_access_token'
export const WEB_REFRESH_COOKIE = 'goferbot_web_refresh_token'
export const ADMIN_ACCESS_COOKIE = 'goferbot_admin_access_token'
export const ADMIN_REFRESH_COOKIE = 'goferbot_admin_refresh_token'

export type AuthApp = 'web' | 'admin'

export function getCookieNamesForApp(app: AuthApp): {
  accessToken: string
  refreshToken: string
} {
  switch (app) {
    case 'web':
      return { accessToken: WEB_ACCESS_COOKIE, refreshToken: WEB_REFRESH_COOKIE }
    case 'admin':
      return { accessToken: ADMIN_ACCESS_COOKIE, refreshToken: ADMIN_REFRESH_COOKIE }
    default:
      throw new Error(`Unknown app: ${app}`)
  }
}
