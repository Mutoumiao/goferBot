import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Prisma } from '@prisma/client'
import { compare, hash } from 'bcrypt'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { TransactionManager } from '../../shared/repositories/transaction-manager.js'
import {
  emailAlreadyExistsError,
  invalidCredentialsError,
  passwordChangeFailedError,
  userNotFoundError,
} from './errors.js'
import { UserPasswordChangedEvent } from './events/user-password-changed.event.js'
import { UserStatusChangedEvent } from './events/user-status-changed.event.js'

const USER_PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  avatar: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const

type UserProfile = {
  id: string
  email: string
  name: string | null
  avatar: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly transactionManager: TransactionManager,
  ) {}

  async findByEmail(email: string): Promise<UserProfile | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: USER_PROFILE_SELECT,
    })
  }

  async findById(id: string): Promise<UserProfile | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: USER_PROFILE_SELECT,
    })
  }

  async create(email: string, password: string, name?: string): Promise<UserProfile> {
    const existing = await this.findByEmail(email)
    if (existing) {
      throw emailAlreadyExistsError()
    }

    const saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS') || 12
    const hashedPassword = await hash(password, saltRounds)

    const user = (await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name: name || null,
        },
        select: USER_PROFILE_SELECT,
      })

      await tx.userRole.create({
        data: {
          userId: created.id,
          roleCode: 'user',
          app: 'web',
        },
      })

      return created
    })) as UserProfile

    return user
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
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }

  async updateName(id: string, name: string): Promise<UserProfile> {
    return this.prisma.user.update({
      where: { id },
      data: { name },
      select: USER_PROFILE_SELECT,
    })
  }

  async updateAvatar(id: string, avatar: string): Promise<UserProfile> {
    return this.prisma.user.update({
      where: { id },
      data: { avatar },
      select: USER_PROFILE_SELECT,
    })
  }

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    })
    if (!user) {
      return false
    }
    return compare(password, user.password)
  }

  async updatePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    })

    if (!user) {
      throw passwordChangeFailedError()
    }

    const isValid = await compare(currentPassword, user.password)
    if (!isValid) {
      throw passwordChangeFailedError()
    }

    return this.doUpdatePassword(userId, newPassword)
  }

  private async doUpdatePassword(targetUserId: string, newPassword: string) {
    const saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS') || 12
    const hashed = await hash(newPassword, saltRounds)

    const updated = await this.transactionManager.run(async (tx) => {
      const result = await tx.user.update({
        where: { id: targetUserId },
        data: { password: hashed },
        select: USER_PROFILE_SELECT,
      })

      const now = new Date()
      await tx.authSession.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'password_changed' },
      })
      await tx.refreshToken.updateMany({
        where: { session: { userId: targetUserId }, revokedAt: null },
        data: { revokedAt: now },
      })

      return result
    })

    this.logger.log(`Password changed for user ${targetUserId}, publishing event`)
    await this.eventEmitter.emitAsync(
      UserPasswordChangedEvent.eventType,
      new UserPasswordChangedEvent(targetUserId),
    )

    return updated
  }

  async setStatus(userId: string, isActive: boolean): Promise<UserProfile> {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    })

    if (!current) {
      throw userNotFoundError()
    }

    if (current.isActive === isActive) {
      const user = await this.findById(userId)
      if (!user) throw userNotFoundError()
      return user
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: USER_PROFILE_SELECT,
    })

    this.logger.log(`Status changed for user ${userId} to ${isActive}, publishing event`)
    await this.eventEmitter.emitAsync(
      UserStatusChangedEvent.eventType,
      new UserStatusChangedEvent(userId, isActive, current.isActive),
    )

    return updated
  }
}
