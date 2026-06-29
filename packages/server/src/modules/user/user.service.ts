import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { compare, hash } from 'bcrypt'
import { AuthRepository } from '../../auth/repositories/auth.repository.js'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { TransactionManager } from '../../shared/repositories/transaction-manager.js'
import {
  emailAlreadyExistsError,
  forbiddenError,
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
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    readonly _authRepository: AuthRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly transactionManager: TransactionManager,
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

  async setStatus(userId: string, isActive: boolean) {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    })

    if (!current) {
      throw userNotFoundError()
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
