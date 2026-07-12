import { Injectable } from '@nestjs/common'
import type { KnowledgeBase, Prisma } from '@prisma/client'
import { BaseRepository } from '../../../shared/repositories/base.repository.js'

export interface KbListItem {
  id: string
  name: string
  icon: string | null
  isPinned: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
  _count?: { documents: number }
}

export type KbCreateData = {
  userId: string
  name: string
  description?: string | null
  icon?: string | null
}

export type KbUpdateData = Partial<
  Pick<KnowledgeBase, 'name' | 'description' | 'isPinned' | 'sortOrder' | 'icon'>
>

@Injectable()
export class KbRepository extends BaseRepository<KnowledgeBase, KbCreateData, KbUpdateData> {
  protected readonly modelName = 'knowledgeBase' as const

  private get kbModel() {
    return this.prisma.knowledgeBase
  }

  async findByUserId(userId: string): Promise<KnowledgeBase[]> {
    return this.kbModel.findMany({ where: { userId } })
  }

  async findByIdAndUser(id: string, userId: string): Promise<KnowledgeBase | null> {
    return this.kbModel.findFirst({ where: { id, userId } })
  }

  async findById(id: string): Promise<KnowledgeBase | null> {
    return this.kbModel.findUnique({ where: { id } })
  }

  async findManyByUserIdWithPagination(
    userId: string,
    page: number,
    size: number,
  ): Promise<KnowledgeBase[]> {
    return this.kbModel.findMany({
      where: { userId },
      // 置顶优先，其后按创建时间倒序，避免新建知识库被挤到末页
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }, { sortOrder: 'asc' }],
      skip: (page - 1) * size,
      take: size,
    })
  }

  async countByUserId(userId: string): Promise<number> {
    return this.kbModel.count({ where: { userId } })
  }

  async findManyForSelector(userId: string, maxItems: number): Promise<KbListItem[]> {
    return this.kbModel.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        icon: true,
        isPinned: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { documents: true } },
      },
      // 置顶优先，其后按创建时间倒序，避免新建知识库被挤到末页
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }, { sortOrder: 'asc' }],
      take: maxItems,
    }) as Promise<KbListItem[]>
  }

  async create(data: KbCreateData): Promise<KnowledgeBase> {
    return this.kbModel.create({
      data: data as unknown as Prisma.KnowledgeBaseUncheckedCreateInput,
    })
  }

  async update(id: string, data: KbUpdateData): Promise<KnowledgeBase> {
    const cleaned = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined),
    ) as Prisma.KnowledgeBaseUpdateInput
    return this.kbModel.update({ where: { id }, data: cleaned })
  }

  async delete(id: string): Promise<KnowledgeBase> {
    return this.kbModel.delete({ where: { id } })
  }
}
