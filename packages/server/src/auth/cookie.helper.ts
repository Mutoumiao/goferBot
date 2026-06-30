import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { FastifyReply } from 'fastify'

@Injectable()
export class CookieHelper {
  constructor(private readonly configService: ConfigService) {}

  setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string) {
    const isProd = this.configService.get('NODE_ENV') === 'production'
    const cookieDomain = this.configService.get<string>('COOKIE_DOMAIN')

    const cookieOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? ('strict' as const) : ('lax' as const),
      path: '/',
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    }

    reply.setCookie('goferbot_access_token', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,
    })

    reply.setCookie('goferbot_refresh_token', refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
  }

  clearAuthCookies(reply: FastifyReply) {
    const isProd = this.configService.get('NODE_ENV') === 'production'
    const cookieDomain = this.configService.get<string>('COOKIE_DOMAIN')

    const cookieOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? ('strict' as const) : ('lax' as const),
      path: '/',
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    }

    reply.clearCookie('goferbot_access_token', cookieOptions)
    reply.clearCookie('goferbot_refresh_token', cookieOptions)
  }
}
