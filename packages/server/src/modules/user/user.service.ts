import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma } from '@prisma/client'
import { compare, hash } from 'bcrypt'
import { AuthRepository } from '../../auth/repositories/auth.repository.js'
import { PrismaService } from '../../processors/database/prisma.service.js'
import {
  emailAlreadyExistsError,
  forbiddenError,
  invalidCredentialsError,
  passwordChangeFailedError,
} from './errors.js'

const USER_PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  avatar: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly authRepository: AuthRepository,
  ) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: USER_PROFILE_SELECT,
    })
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: USER_PROFILE_SELECT,
    })
  }

  async create(email: string, password: string, name?: string) {
    const existing = await this.findByEmail(email)
    if (existing) {
      throw emailAlreadyExistsError()
    }

    const saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS') || 12

    return this.prisma.user.create({
      data: {
        email,
        password: await hash(password, saltRounds),
        name: name || null,
      },
      select: USER_PROFILE_SELECT,
    })
  }

  async validatePassword(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      throw invalidCredentialsError()
    }

    const isValid = await compare(password, user.password)
    if (!isValid) {
      throw invalidCredentialsError()
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }

  async updateName(id: string, name: string) {
    return this.prisma.user.update({
      where: { id },
      data: { name },
      select: USER_PROFILE_SELECT,
    })
  }

  async updateAvatar(id: string, avatar: string) {
    return this.prisma.user.update({
      where: { id },
      data: { avatar },
      select: USER_PROFILE_SELECT,
    })
  }

  async updatePassword(
    callerId: string,
    targetUserId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    if (callerId !== targetUserId) {
      throw forbiddenError()
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, password: true },
    })

    if (!user) {
      throw passwordChangeFailedError()
    }

    const isValid = await compare(currentPassword, user.password)
    if (!isValid) {
      throw passwordChangeFailedError()
    }

    const saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS') || 12
    const hashed = await hash(newPassword, saltRounds)

    // 原子事务：密码更新与会话撤销必须同时成功，避免状态不一致
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const now = new Date()

      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: { password: hashed },
        select: USER_PROFILE_SELECT,
      })

      // 仅在密码更新成功后撤销会话，防止合法用户因密码更新失败被错误锁死
      await tx.authSession.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'password_changed' },
      })
      await tx.refreshToken.updateMany({
        where: { session: { userId: targetUserId }, revokedAt: null },
        data: { revokedAt: now },
      })

      return updated
    })
  }
}
