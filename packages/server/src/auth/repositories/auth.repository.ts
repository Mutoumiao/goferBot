import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { TransactionCapable } from '../../shared/repositories/transaction-capable.js'
import type { AuthApp } from '../types/auth-app.type.js'

@Injectable()
export class AuthRepository {
  private readonly tx: TransactionCapable

  constructor(private readonly prisma: PrismaService) {
    this.tx = new TransactionCapable(prisma)
  }

  async createSession(data: { userId: string; app: AuthApp; userAgent?: string; ip?: string }) {
    return this.prisma.authSession.create({
      data: {
        userId: data.userId,
        app: data.app,
        userAgent: data.userAgent,
        ip: data.ip,
      },
    })
  }

  async createSessionWithTokenPair(
    userId: string,
    app: AuthApp,
    jtiHash: string,
    meta?: { userAgent?: string; ip?: string },
  ) {
    return this.tx.run(async (tx) => {
      const session = await tx.authSession.create({
        data: {
          userId,
          app,
          userAgent: meta?.userAgent,
          ip: meta?.ip,
        },
      })
      await tx.refreshToken.create({
        data: {
          sessionId: session.id,
          jtiHash,
        },
      })
      return session
    })
  }

  async findSessionById(sessionId: string) {
    return this.prisma.authSession.findUnique({
      where: { id: sessionId },
      include: { refreshTokens: true },
    })
  }

  async revokeSession(sessionId: string, reason: string) {
    return this.prisma.authSession.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    })
  }

  async revokeAllSessionsForUser(userId: string, reason: string): Promise<void> {
    const now = new Date()
    await this.tx.run(async (tx) => {
      await tx.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now, revokedReason: reason },
      })
      await tx.refreshToken.updateMany({
        where: { session: { userId }, revokedAt: null },
        data: { revokedAt: now },
      })
    })
  }

  async insertRefreshToken(data: { sessionId: string; jtiHash: string; parentTokenId?: string }) {
    return this.prisma.refreshToken.create({
      data: {
        sessionId: data.sessionId,
        jtiHash: data.jtiHash,
        parentTokenId: data.parentTokenId,
      },
    })
  }

  async findRefreshTokenByJtiHash(jtiHash: string) {
    return this.prisma.refreshToken.findUnique({
      where: { jtiHash },
      include: { session: true },
    })
  }

  async markRefreshTokenUsed(jtiHash: string, replacedByTokenId?: string): Promise<boolean> {
    const now = new Date()
    const result = (await this.prisma.$queryRaw`
      UPDATE "RefreshToken"
      SET "usedAt" = ${now},
          "replacedByTokenId" = ${replacedByTokenId ?? null}
      WHERE "jtiHash" = ${jtiHash}
        AND "usedAt" IS NULL
        AND "revokedAt" IS NULL
      RETURNING "id"
    `) as Array<{ id: string }>
    return result.length > 0
  }

  async updateLastSeen(sessionId: string) {
    return this.prisma.authSession.update({
      where: { id: sessionId },
      data: { lastSeenAt: new Date() },
    })
  }

  async getRolesForUserByApp(userId: string, app: AuthApp) {
    return this.prisma.userRole.findMany({
      where: { userId, app },
      select: { role: true },
    })
  }

  async isAuthMethodEnabled(applicationCode: string, provider: string): Promise<boolean> {
    const application = await this.prisma.application.findUnique({
      where: { code: applicationCode },
      select: { id: true, status: true },
    })

    if (application?.status !== 'active') {
      return false
    }

    const method = await this.prisma.applicationAuthMethod.findUnique({
      where: {
        applicationId_provider: {
          applicationId: application.id,
          provider,
        },
      },
      select: { enabled: true },
    })

    return method?.enabled === true
  }
}
