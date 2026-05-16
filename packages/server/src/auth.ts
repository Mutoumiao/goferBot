import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './db/index.js'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days (seconds)
    updateAge: 60 * 60 * 24 * 3, // 3 days (seconds) — sliding renewal threshold
    cookieName: 'goferbot.session',
    cookieCache: {
      enabled: false,
    },
  },
  advanced: {
    cookiePrefix: 'goferbot',
    generateId: false,
  },
  cookies: {
    sessionToken: {
      name: 'goferbot.session',
      attributes: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      },
    },
  },
})
