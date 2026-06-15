import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../processors/database/prisma.service.js'
import { BaseRepository } from '../../../shared/repositories/base.repository.js'
import type { Session, Prisma } from '@prisma/client'

@Injectable()
export class SessionRepository extends BaseRepository<
  Session,
  Prisma.SessionUncheckedCreateInput,
  Prisma.SessionUncheckedUpdateInput
> {
  protected readonly modelName = 'session' as const

  constructor(prisma: PrismaService) {
    super(prisma)
  }

  async findByUserId(userId: string): Promise<Session[]> {
    return this.model.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async findByIdAndUser(id: string, userId: string): Promise<Session | null> {
    return this.model.findFirst({ where: { id, userId } })
  }
}
