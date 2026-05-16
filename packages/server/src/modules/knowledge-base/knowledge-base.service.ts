import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import type { CreateKbDto } from './dto/create-kb.dto.js'
import type { UpdateKbDto } from './dto/update-kb.dto.js'
import type { CreateFolderDto } from './dto/create-folder.dto.js'
import type { UpdateFolderDto } from './dto/update-folder.dto.js'

@Injectable()
export class KnowledgeBaseService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- 知识库 ----

  async list(userId: string) {
    return this.prisma.knowledgeBase.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    })
  }

  async create(userId: string, dto: CreateKbDto) {
    const maxOrder = await this.prisma.knowledgeBase.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    })

    return this.prisma.knowledgeBase.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description ?? null,
        icon: dto.icon ?? null,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
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
    await this.prisma.knowledgeBase.delete({ where: { id } })
    return { id, deleted: true }
  }

  // ---- 文件夹 ----

  async listFolders(userId: string, kbId: string, parentId?: string) {
    await this.ensureOwnership(userId, kbId)

    return this.prisma.folder.findMany({
      where: {
        kbId,
        parentId: parentId ?? null,
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  async createFolder(userId: string, kbId: string, dto: CreateFolderDto) {
    await this.ensureOwnership(userId, kbId)

    if (dto.parentId) {
      const parent = await this.prisma.folder.findFirst({
        where: { id: dto.parentId, kbId },
      })
      if (!parent) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: '父文件夹不存在',
        })
      }
    }

    return this.prisma.folder.create({
      data: {
        kbId,
        parentId: dto.parentId ?? null,
        name: dto.name,
      },
    })
  }

  async updateFolder(
    userId: string,
    kbId: string,
    folderId: string,
    dto: UpdateFolderDto,
  ) {
    await this.ensureOwnership(userId, kbId)

    const folder = await this.prisma.folder.findFirst({
      where: { id: folderId, kbId },
    })
    if (!folder) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '文件夹不存在',
      })
    }

    return this.prisma.folder.update({
      where: { id: folderId },
      data: { name: dto.name },
    })
  }

  async removeFolder(userId: string, kbId: string, folderId: string) {
    await this.ensureOwnership(userId, kbId)

    const folder = await this.prisma.folder.findFirst({
      where: { id: folderId, kbId },
    })
    if (!folder) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '文件夹不存在',
      })
    }

    await this.prisma.folder.delete({ where: { id: folderId } })
    return { id: folderId, deleted: true }
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
