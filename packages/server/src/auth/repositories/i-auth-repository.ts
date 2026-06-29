import type { AuthSession, RefreshToken } from '@prisma/client'
import type { AuthApp } from '../types/auth-app.type.js'

export interface IAuthRepository {
  createSession(data: {
    userId: string
    app: AuthApp
    userAgent?: string
    ip?: string
  }): Promise<AuthSession>
  createSessionWithTokenPair(
    userId: string,
    app: AuthApp,
    jtiHash: string,
    meta?: { userAgent?: string; ip?: string },
  ): Promise<AuthSession>
  findSessionById(sessionId: string): Promise<AuthSession | null>
  revokeSession(sessionId: string, reason: string): Promise<AuthSession>
  revokeAllSessionsForUser(userId: string, reason: string): Promise<void>
  insertRefreshToken(data: {
    sessionId: string
    jtiHash: string
    parentTokenId?: string
  }): Promise<RefreshToken>
  findRefreshTokenByJtiHash(jtiHash: string): Promise<RefreshToken | null>
  markRefreshTokenUsed(jtiHash: string, replacedByTokenId?: string): Promise<boolean>
  updateLastSeen(sessionId: string): Promise<AuthSession>
  getRolesForUserByApp(userId: string, app: AuthApp): Promise<Array<{ role: string }>>
  isAuthMethodEnabled(applicationCode: string, provider: string): Promise<boolean>
}
