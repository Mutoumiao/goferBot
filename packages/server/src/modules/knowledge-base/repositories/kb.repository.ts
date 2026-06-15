import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../processors/database/prisma.service.js'
import { BaseRepository } from '../../../shared/repositories/base.repository.js'
import type { KnowledgeBase, Prisma } from '@prisma/client'

@Injectable()
export class KbRepository extends BaseRepository<
  KnowledgeBase,
  Prisma.KnowledgeBaseCreateInput,
  Prisma.KnowledgeBaseUpdateInput
> {
  protected readonly modelName = 'knowledgeBase' as const

  constructor(prisma: PrismaService) {
    super(prisma)
  }

  async findByUserId(userId: string): Promise<KnowledgeBase[]> {
    return this.model.findMany({ where: { userId } })
  }

  async findByIdAndUser(id: string, userId: string): Promise<KnowledgeBase | null> {
    return this.model.findFirst({ where: { id, userId } })
  }
}
