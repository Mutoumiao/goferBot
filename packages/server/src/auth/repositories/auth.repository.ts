import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import type { AuthApp } from '../types/auth-app.type.js'

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

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
    await this.prisma.$transaction([
      this.prisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now, revokedReason: reason },
      }),
      this.prisma.refreshToken.updateMany({
        where: { session: { userId }, revokedAt: null },
        data: { revokedAt: now },
      }),
    ])
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

  /**
   * 原子标记 refresh token 为已使用。
   * 使用 UPDATE ... WHERE usedAt IS NULL 确保并发安全：
   * 只有第一个请求能成功更新（count > 0），其余请求返回 false（触发重放检测）。
   */
  async markRefreshTokenUsed(jtiHash: string, replacedByTokenId?: string): Promise<boolean> {
    const result = await this.prisma.refreshToken.updateMany({
      where: {
        jtiHash,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
        replacedByTokenId,
      },
    })

    return result.count > 0
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
