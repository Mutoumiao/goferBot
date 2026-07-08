import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { FastifyReply } from 'fastify'
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_REFRESH_COOKIE,
  WEB_ACCESS_COOKIE,
  WEB_REFRESH_COOKIE,
} from '@goferbot/data'
import type { AuthApp } from './types/auth-app.type.js'

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

@Injectable()
export class CookieHelper {
  constructor(private readonly configService: ConfigService) {}

  private getCookieOptions() {
    const isProd = this.configService.get('NODE_ENV') === 'production'
    const cookieDomain = this.configService.get<string>('COOKIE_DOMAIN')

    return {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? ('strict' as const) : ('lax' as const),
      path: '/',
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    }
  }

  setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string, app: AuthApp) {
    const opts = this.getCookieOptions()
    const { accessToken: accessName, refreshToken: refreshName } = getCookieNamesForApp(app)

    reply.setCookie(accessName, accessToken, {
      ...opts,
      maxAge: 15 * 60 * 1000,
    })

    reply.setCookie(refreshName, refreshToken, {
      ...opts,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
  }

  clearAuthCookies(reply: FastifyReply, app: AuthApp) {
    const opts = this.getCookieOptions()
    const { accessToken: accessName, refreshToken: refreshName } = getCookieNamesForApp(app)

    reply.clearCookie(accessName, opts)
    reply.clearCookie(refreshName, opts)
  }
}
