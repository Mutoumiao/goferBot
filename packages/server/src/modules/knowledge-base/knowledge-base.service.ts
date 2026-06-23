import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import type { CreateKbDto } from './dto/create-kb.dto.js'
import type { UpdateKbDto } from './dto/update-kb.dto.js'
import { KbCleanupService } from './kb-cleanup.service.js'

const MAX_SEARCH_QUERY_LENGTH = 100
const MAX_SELECTOR_ITEMS = 100

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
      orderBy: [{ isPinned: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    })
  }

  async listForSelector(userId: string) {
    const rows = await this.prisma.knowledgeBase.findMany({
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
      orderBy: [{ isPinned: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: MAX_SELECTOR_ITEMS,
    })

    return rows.map((kb) => ({
      id: kb.id,
      name: kb.name,
      icon: kb.icon ?? undefined,
      isPinned: kb.isPinned,
      sortOrder: kb.sortOrder,
      fileCount: kb._count.documents,
      createdAt: kb.createdAt.toISOString(),
      updatedAt: kb.updatedAt.toISOString(),
    }))
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

  async search(userId: string, kbId: string, query: string) {
    await this.ensureOwnership(userId, kbId)

    const trimmed = query.trim()
    if (!trimmed) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '搜索关键词不能为空',
      })
    }
    if (trimmed.length > MAX_SEARCH_QUERY_LENGTH) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `搜索关键词不能超过 ${MAX_SEARCH_QUERY_LENGTH} 个字符`,
      })
    }

    const MAX_SEARCH_RESULTS = 100

    const [folders, documents] = await Promise.all([
      this.prisma.folder.findMany({
        where: { kbId, name: { contains: trimmed, mode: 'insensitive' } },
        orderBy: { createdAt: 'asc' },
        take: MAX_SEARCH_RESULTS,
      }),
      this.prisma.document.findMany({
        where: { kbId, name: { contains: trimmed, mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' },
        take: MAX_SEARCH_RESULTS,
      }),
    ])

    return { folders, documents }
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
