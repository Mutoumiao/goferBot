import { createHash } from 'node:crypto'
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma } from '@prisma/client'
import { hash } from 'bcrypt'
import { PrismaService } from '../../../processors/database/prisma.service.js'

@Injectable()
export class SuperAdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SuperAdminBootstrapService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private async ensureApplicationAuthMethods(tx: Prisma.TransactionClient): Promise<void> {
    await tx.application.upsert({
      where: { code: 'admin' },
      update: { status: 'active' },
      create: { code: 'admin', name: '管理后台', status: 'active' },
    })

    await tx.application.upsert({
      where: { code: 'web' },
      update: { status: 'active' },
      create: { code: 'web', name: 'Web 客户端', status: 'active' },
    })

    const adminApp = await tx.application.findUnique({ where: { code: 'admin' } })
    const webApp = await tx.application.findUnique({ where: { code: 'web' } })

    if (adminApp) {
      await tx.applicationAuthMethod.upsert({
        where: { applicationId_provider: { applicationId: adminApp.id, provider: 'password' } },
        update: { enabled: true },
        create: { applicationId: adminApp.id, provider: 'password', enabled: true },
      })
    }

    if (webApp) {
      await tx.applicationAuthMethod.upsert({
        where: { applicationId_provider: { applicationId: webApp.id, provider: 'password' } },
        update: { enabled: true },
        create: { applicationId: webApp.id, provider: 'password', enabled: true },
      })
    }
  }

  private async ensureSystemRoles(tx: Prisma.TransactionClient): Promise<void> {
    const roles = [
      { code: 'super_admin', name: '超级管理员', app: 'admin', isSystem: true, sortOrder: 0 },
      { code: 'admin', name: '管理员', app: 'admin', isSystem: true, sortOrder: 10 },
      { code: 'user', name: '普通用户', app: 'web', isSystem: true, sortOrder: 0 },
    ] as const

    for (const role of roles) {
      await tx.role.upsert({
        where: { code: role.code },
        update: {
          name: role.name,
          app: role.app,
          isSystem: role.isSystem,
          sortOrder: role.sortOrder,
          status: 'active',
        },
        create: {
          code: role.code,
          name: role.name,
          app: role.app,
          isSystem: role.isSystem,
          sortOrder: role.sortOrder,
          status: 'active',
        },
      })
    }
  }

  async onApplicationBootstrap() {
    await this.bootstrap()
  }

  async bootstrap(): Promise<void> {
    const email = this.configService.get<string>('SUPER_ADMIN_EMAIL')
    const password = this.configService.get<string>('SUPER_ADMIN_PASSWORD')

    if (!email || !password) {
      this.logger.warn(
        'No SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD configured. ' +
          'Skipping super admin bootstrap.',
      )
      return
    }

    const normalizedEmail = email.trim().toLowerCase()
    const hashRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS') || 10
    const hashedPassword = await hash(password, hashRounds)

    await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await this.ensureApplicationAuthMethods(tx)
        await this.ensureSystemRoles(tx)

        const existingSuperAdmin = await tx.userRole.findFirst({
          where: { roleCode: 'super_admin', app: 'admin' },
          select: { userId: true },
        })

        if (existingSuperAdmin) {
          this.logger.debug('Bootstrap skipped: super admin already exists')
          return
        }

        const existingFlag = await tx.systemFlag.findUnique({
          where: { key: 'super_admin_bootstrapping' },
        })
        if (existingFlag) {
          const updatedAt = existingFlag.updatedAt
          if (updatedAt.getTime() > Date.now() - 30_000) {
            this.logger.debug('Bootstrap lock held by another instance, skipping')
            return
          }
        }

        await tx.systemFlag.upsert({
          where: { key: 'super_admin_bootstrapping' },
          update: {
            value: { email: normalizedEmail, timestamp: new Date().toISOString() },
          },
          create: {
            key: 'super_admin_bootstrapping',
            value: { email: normalizedEmail, timestamp: new Date().toISOString() },
          },
        })

        const existingUser = await tx.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true },
        })

        let userId: string
        if (existingUser) {
          userId = existingUser.id
        } else {
          const created = await tx.user.create({
            data: {
              email: normalizedEmail,
              password: hashedPassword,
              name: 'Super Admin',
              isActive: true,
            },
            select: { id: true },
          })
          userId = created.id
        }

        await tx.userRole.createMany({
          data: [
            { userId, app: 'admin', roleCode: 'super_admin' },
            { userId, app: 'admin', roleCode: 'admin' },
            { userId, app: 'web', roleCode: 'user' },
          ],
          skipDuplicates: true,
        })

        await tx.systemFlag.upsert({
          where: { key: 'super_admin_bootstrapped' },
          update: {
            value: { email: normalizedEmail, userId, timestamp: new Date() },
          },
          create: {
            key: 'super_admin_bootstrapped',
            value: { email: normalizedEmail, userId, timestamp: new Date() },
          },
        })

        await tx.adminAuditLog.create({
          data: {
            actor: 'system:bootstrap',
            operation: 'SUPER_ADMIN_INIT',
            target: 'user',
            targetId: userId,
            result: 'success',
            metadata: {
              emailHash: createHash('sha256').update(normalizedEmail).digest('hex'),
              timestamp: new Date(),
            },
          },
        })

        this.logger.log(`Super admin bootstrapped: ${normalizedEmail}`)
      },
      { maxWait: 5000, timeout: 10_000 },
    )
  }
}
