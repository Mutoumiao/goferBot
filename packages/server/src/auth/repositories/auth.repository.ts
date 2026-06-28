import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../../processors/database/prisma.service.js'
import type { AuthApp } from '../types/auth-app.type.js'

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(data: {
    userId: string
    app: AuthApp
    userAgent?: string
    ip?: string
  }) {
    return this.prisma.authSession.create({
      data: {
        userId: data.userId,
        app: data.app,
        userAgent: data.userAgent,
        ip: data.ip,
      },
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

  async insertRefreshToken(data: {
    sessionId: string
    jtiHash: string
  }) {
    return this.prisma.refreshToken.create({
      data: {
        sessionId: data.sessionId,
        jtiHash: data.jtiHash,
      },
    })
  }

  async findRefreshTokenByJtiHash(jtiHash: string) {
    return this.prisma.refreshToken.findUnique({
      where: { jtiHash },
      include: { session: true },
    })
  }

  async markRefreshTokenUsed(jtiHash: string, replacedByTokenId?: string) {
    return this.prisma.refreshToken.update({
      where: { jtiHash },
      data: {
        usedAt: new Date(),
        replacedByTokenId,
      },
    })
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
}
