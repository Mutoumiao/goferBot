import { constants, publicEncrypt } from 'node:crypto'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import {
  ADMIN_ACCESS_COOKIE,
  WEB_ACCESS_COOKIE,
} from '../../../packages/data/src/constants/cookie.js'

const TEST_INVITATION_CODE = 'GF-test-code-001'

function extractCookieValue(setCookieHeader: string | string[] | undefined, name: string): string {
  const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]
  for (const header of headers) {
    if (!header) continue
    const prefix = `${name}=`
    if (header.startsWith(prefix)) {
      const rest = header.slice(prefix.length)
      const end = rest.indexOf(';')
      return end === -1 ? rest : rest.slice(0, end)
    }
  }
  throw new Error(`Cookie "${name}" not found in Set-Cookie header`)
}

function extractAccessToken(
  res: { headers: Record<string, unknown> },
  cookieName: string = WEB_ACCESS_COOKIE,
): string {
  const setCookie = res.headers['set-cookie'] as string | string[] | undefined
  return extractCookieValue(setCookie, cookieName)
}

export const AuthFixtures = {
  normalUser: { email: 'test@gofer.bot', password: 'Test1234!' },
  adminUser: { email: 'admin@gofer.bot', password: 'Admin1234!' },

  async createUser(
    app: NestFastifyApplication,
    user: { email: string; password: string; name?: string },
    opts?: { remoteAddress?: string },
  ) {
    const encryptedPassword = await this.encryptPassword(app, user.password, opts)
    const res = await app.inject({
      method: 'POST',
      url: '/api/web/auth/register',
      payload: {
        email: user.email,
        encryptedPassword,
        name: user.name,
        invitationCode: TEST_INVITATION_CODE,
      },
      remoteAddress: opts?.remoteAddress,
    })
    if (res.statusCode >= 400) {
      throw new Error(`createUser failed: ${res.statusCode} ${res.body}`)
    }
    const body = res.json()
    const data = body.data ? body.data : body
    return data.user
  },

  async loginAs(
    app: NestFastifyApplication,
    user: { email: string; password: string },
    opts?: { remoteAddress?: string },
  ): Promise<string> {
    return this.loginAsWeb(app, user, opts)
  },

  async loginAsWeb(
    app: NestFastifyApplication,
    user: { email: string; password: string },
    opts?: { remoteAddress?: string },
  ): Promise<string> {
    const encryptedPassword = await this.encryptPassword(app, user.password, opts)
    const res = await app.inject({
      method: 'POST',
      url: '/api/web/auth/login',
      payload: { email: user.email, encryptedPassword },
      remoteAddress: opts?.remoteAddress,
    })
    if (res.statusCode >= 400) {
      throw new Error(`loginAsWeb failed: ${res.statusCode} ${res.body}`)
    }
    return extractAccessToken(res)
  },

  async loginAsAdmin(
    app: NestFastifyApplication,
    user: { email: string; password: string },
    opts?: { remoteAddress?: string },
  ): Promise<string> {
    const encryptedPassword = await this.encryptPassword(app, user.password, opts)
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { email: user.email, encryptedPassword },
      remoteAddress: opts?.remoteAddress,
    })
    if (res.statusCode >= 400) {
      throw new Error(`loginAsAdmin failed: ${res.statusCode} ${res.body}`)
    }
    return extractAccessToken(res, ADMIN_ACCESS_COOKIE)
  },

  async encryptPassword(
    app: NestFastifyApplication,
    password: string,
    opts?: { remoteAddress?: string },
  ): Promise<string> {
    const keyRes = await app.inject({
      method: 'GET',
      url: '/api/auth/public-key',
      remoteAddress: opts?.remoteAddress,
    })
    const body = keyRes.json()
    const publicKey = body.data ? body.data.publicKey : body.publicKey

    const encrypted = publicEncrypt(
      { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(password),
    )
    return encrypted.toString('base64')
  },
}

export function authHeader(token: string): { cookie: string } {
  return { cookie: `${WEB_ACCESS_COOKIE}=${token}` }
}

export function adminAuthHeader(token: string): { cookie: string } {
  return { cookie: `${ADMIN_ACCESS_COOKIE}=${token}` }
}
