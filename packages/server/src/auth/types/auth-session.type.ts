import type { AuthApp } from './auth-app.type.js'

export interface AuthSessionContext {
  sessionId: string
  userId: string
  app: AuthApp
  roles: string[]
}
