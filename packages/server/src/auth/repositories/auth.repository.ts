import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
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
   * 只有第一个请求能成功更新，其余请求返回 null（触发重放检测）。
   */
  async markRefreshTokenUsed(
    jtiHash: string,
    replacedByTokenId?: string,
  ): Promise<{ id: string; usedAt: Date } | null> {
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

    // updateMany 只返回 count，需要再查询获取具体数据
    if (result.count === 0) {
      return null
    }

    const token = await this.prisma.refreshToken.findUnique({
      where: { jtiHash },
      select: { id: true, usedAt: true },
    })

    if (!token) {
      return null
    }

    return { id: token.id, usedAt: token.usedAt! }
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
