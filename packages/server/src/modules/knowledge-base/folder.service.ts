import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { KbCleanupService } from './kb-cleanup.service.js'
import type { CreateFolderDto } from './dto/create-folder.dto.js'
import type { UpdateFolderDto } from './dto/update-folder.dto.js'

@Injectable()
export class FolderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cleanupService: KbCleanupService,
  ) {}

  async list(userId: string, kbId: string, parentId?: string) {
    await this.ensureOwnership(userId, kbId)

    return this.prisma.folder.findMany({
      where: {
        kbId,
        parentId: parentId ?? null,
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  async create(userId: string, kbId: string, dto: CreateFolderDto) {
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

  async update(
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

  async remove(userId: string, kbId: string, folderId: string) {
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

    await this.cleanupService.cleanupFolder(kbId, folderId)
    await this.prisma.folder.delete({ where: { id: folderId } })
    return { id: folderId, deleted: true }
  }

  async findAncestors(folderId: string): Promise<Array<{ id: string; name: string; parentId: string | null }>> {
    const ancestors: Array<{ id: string; name: string; parentId: string | null }> = []
    let current = await this.prisma.folder.findUnique({ where: { id: folderId } })

    while (current) {
      ancestors.unshift({
        id: current.id,
        name: current.name,
        parentId: current.parentId,
      })
      if (!current.parentId) break
      current = await this.prisma.folder.findUnique({ where: { id: current.parentId } })
    }

    return ancestors
  }

  async isDescendant(ancestorId: string, descendantId: string): Promise<boolean> {
    let current = await this.prisma.folder.findUnique({ where: { id: descendantId } })
    while (current?.parentId) {
      if (current.parentId === ancestorId) return true
      current = await this.prisma.folder.findUnique({ where: { id: current.parentId } })
    }
    return false
  }

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
