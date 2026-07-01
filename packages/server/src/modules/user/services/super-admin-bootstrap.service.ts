import { createHash } from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma } from '@prisma/client'
import { hash } from 'bcrypt'
import { PrismaService } from '../../../processors/database/prisma.service.js'

@Injectable()
export class SuperAdminBootstrapService {
  private readonly logger = new Logger(SuperAdminBootstrapService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private async ensureApplicationAuthMethods(): Promise<void> {
    await this.prisma.application.upsert({
      where: { code: 'admin' },
      update: { status: 'active' },
      create: { code: 'admin', name: '管理后台', status: 'active' },
    })

    await this.prisma.application.upsert({
      where: { code: 'web' },
      update: { status: 'active' },
      create: { code: 'web', name: 'Web 客户端', status: 'active' },
    })

    const adminApp = await this.prisma.application.findUnique({ where: { code: 'admin' } })
    const webApp = await this.prisma.application.findUnique({ where: { code: 'web' } })

    if (adminApp) {
      await this.prisma.applicationAuthMethod.upsert({
        where: { applicationId_provider: { applicationId: adminApp.id, provider: 'password' } },
        update: { enabled: true },
        create: { applicationId: adminApp.id, provider: 'password', enabled: true },
      })
    }

    if (webApp) {
      await this.prisma.applicationAuthMethod.upsert({
        where: { applicationId_provider: { applicationId: webApp.id, provider: 'password' } },
        update: { enabled: true },
        create: { applicationId: webApp.id, provider: 'password', enabled: true },
      })
    }
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

    await this.ensureApplicationAuthMethods()

    // 幂等判断：用 findFirst 而非 count，O(1) 索引查询
    const existing = await this.prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    })
    if (existing) {
      this.logger.debug('Bootstrap skipped: super admin already exists')
      return
    }

    const totalUsers = await this.prisma.user.count()
    if (totalUsers > 0) {
      this.logger.warn(
        `Users exist (${totalUsers}) but no SUPER_ADMIN. ` +
          'Attempting to create super admin anyway (fill missing role).',
      )
    }

    // bcrypt 在事务外执行，缩短持锁时间
    const normalizedEmail = email.trim().toLowerCase()
    const hashRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS') || 10
    const hashedPassword = await hash(password, hashRounds)
    const start = Date.now()

    try {
      await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          // 事务内二次检查，防止并发竞态
          const recheck = await tx.user.findFirst({
            where: { role: 'SUPER_ADMIN' },
            select: { id: true },
          })
          if (recheck) {
            this.logger.debug('Bootstrap skipped (transaction): super admin already exists')
            return
          }

          // 抢占锁：若标记已存在，说明有其他实例正在引导，跳过
          const existingFlag = await tx.systemFlag.findUnique({
            where: { key: 'super_admin_bootstrapping' },
          })
          if (existingFlag) {
            const updatedAt = existingFlag.updatedAt
            // 如果锁未过期（30 秒内），视为其他实例正在引导
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

          const user = await tx.user.create({
            data: {
              email: normalizedEmail,
              password: hashedPassword,
              name: 'Super Admin',
              role: 'SUPER_ADMIN',
              isActive: true,
              mustChangePassword: true,
            },
            select: { id: true },
          })

          const { count } = await tx.userRole.createMany({
            data: [
              { userId: user.id, app: 'admin', role: 'OWNER' },
              { userId: user.id, app: 'web', role: 'OWNER' },
            ],
          })

          if (count !== 2) {
            throw new Error(`Expected 2 user roles, got ${count}`)
          }

          // 写入幂等标记
          await tx.systemFlag.upsert({
            where: { key: 'super_admin_bootstrapped' },
            update: {
              value: { email: normalizedEmail, userId: user.id, timestamp: new Date() },
            },
            create: {
              key: 'super_admin_bootstrapped',
              value: { email: normalizedEmail, userId: user.id, timestamp: new Date() },
            },
          })

          // 写入审计日志
          await tx.adminAuditLog.create({
            data: {
              actor: 'system:bootstrap',
              operation: 'SUPER_ADMIN_INIT',
              target: 'user',
              targetId: user.id,
              result: 'success',
              metadata: {
                emailHash: createHash('sha256').update(normalizedEmail).digest('hex'),
                timestamp: new Date(),
              },
            },
          })
        },
        { maxWait: 5000, timeout: 10_000 },
      )

      this.logger.log(`Super admin created: ${normalizedEmail} in ${Date.now() - start}ms`)
    } catch (err) {
      // P2002 唯一约束冲突：并发实例竞态，降级为 warn
      if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
        this.logger.warn('Bootstrap raced with another instance, skipping')
        return
      }
      // fail-closed：其他异常直接抛出，由调用方决定是否终止进程
      this.logger.error('Super admin bootstrap failed', err)
      throw err
    }
  }
}
