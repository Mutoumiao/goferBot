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
  revokeOtherSessions(userId: string, currentSessionId: string, reason: string): Promise<void>
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
  findUserById(userId: string): Promise<{
    id: string
    email: string
    name: string | null
    avatar: string | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
  } | null>
  findValidSession(sessionId: string): Promise<AuthSession | null>
  findInvitationCodeByCode(code: string): Promise<{
    id: string
    code: string
    type: string
    maxUses: number | null
    usedCount: number
    usedBy: string | null
    expiresAt: Date | null
  } | null>
  useStandardInvitationCode(codeId: string, userId: string): Promise<void>
  useTestInvitationCode(codeId: string): Promise<void>
  createUserRole(userId: string, roleCode: string, app: AuthApp): Promise<void>
}
