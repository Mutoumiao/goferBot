import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../processors/database/prisma.service.js'
import { BaseRepository } from '../../../shared/repositories/base.repository.js'
import type { Folder, Prisma } from '@prisma/client'

@Injectable()
export class FolderRepository extends BaseRepository<
  Folder,
  Prisma.FolderCreateInput,
  Prisma.FolderUpdateInput
> {
  protected readonly modelName = 'folder' as const

  constructor(prisma: PrismaService) {
    super(prisma)
  }

  async findByKbId(kbId: string, parentId?: string | null): Promise<Folder[]> {
    const where: Prisma.FolderWhereInput = { kbId }
    if (parentId !== undefined) {
      where.parentId = parentId ?? null
    }
    return this.model.findMany({ where })
  }

  async findByIdAndKb(id: string, kbId: string): Promise<Folder | null> {
    return this.model.findFirst({ where: { id, kbId } })
  }

  async hasChildren(id: string): Promise<boolean> {
    const count = await this.model.count({ where: { parentId: id } })
    return count > 0
  }
}
