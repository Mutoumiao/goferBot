import { constants, publicEncrypt } from 'node:crypto'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

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
      url: '/api/auth/register',
      payload: { email: user.email, encryptedPassword, name: user.name },
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
    const encryptedPassword = await this.encryptPassword(app, user.password, opts)
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: user.email, encryptedPassword },
      remoteAddress: opts?.remoteAddress,
    })
    if (res.statusCode >= 400) {
      throw new Error(`loginAs failed: ${res.statusCode} ${res.body}`)
    }
    const body = res.json()
    const data = body.data ? body.data : body
    return data.accessToken
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
