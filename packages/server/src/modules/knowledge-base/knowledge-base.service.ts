import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { KbCleanupService } from './kb-cleanup.service.js'
import type { CreateKbDto } from './dto/create-kb.dto.js'
import type { UpdateKbDto } from './dto/update-kb.dto.js'

@Injectable()
export class KnowledgeBaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cleanupService: KbCleanupService,
  ) {}

  // ---- 知识库 ----

  async list(userId: string) {
    return this.prisma.knowledgeBase.findMany({
      where: { userId },
      orderBy: [
        { isPinned: 'desc' },
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    })
  }

  async create(userId: string, dto: CreateKbDto) {
    return this.prisma.knowledgeBase.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description ?? null,
        icon: dto.icon ?? null,
      },
    })
  }

  async update(userId: string, id: string, dto: UpdateKbDto) {
    await this.ensureOwnership(userId, id)

    return this.prisma.knowledgeBase.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isPinned !== undefined && { isPinned: dto.isPinned }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
      },
    })
  }

  async remove(userId: string, id: string) {
    await this.ensureOwnership(userId, id)
    await this.cleanupService.cleanupKnowledgeBase(id)
    await this.prisma.knowledgeBase.delete({ where: { id } })
    return { id, deleted: true }
  }

  // ---- 私有方法 ----

  private async ensureOwnership(userId: string, kbId: string) {
    const kb = await this.prisma.knowledgeBase.findUnique({
      where: { id: kbId },
      select: { userId: true },
    })

    if (!kb) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '知识库不存在',
      })
    }

    if (kb.userId !== userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '无权访问该资源',
      })
    }
  }
}
