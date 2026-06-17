import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { KbCleanupService } from './kb-cleanup.service.js'
import type { CreateFolderDto } from './dto/create-folder.dto.js'
import type { UpdateFolderDto } from './dto/update-folder.dto.js'
import type { MoveFolderDto } from './dto/move-folder.dto.js'
import type { CopyFolderDto } from './dto/copy-folder.dto.js'
import { DocumentService } from './document.service.js'

type SortOrder = 'asc' | 'desc'
type FolderSortBy = 'name' | 'createdAt' | 'updatedAt'

const FOLDER_SORT_BY: readonly string[] = ['name', 'createdAt', 'updatedAt']
const SORT_ORDER: readonly string[] = ['asc', 'desc']

function parseFolderSort(sortBy?: string, sortOrder?: string): { sortBy: FolderSortBy; sortOrder: SortOrder } {
  const by = sortBy && FOLDER_SORT_BY.includes(sortBy) ? (sortBy as FolderSortBy) : 'createdAt'
  const order = sortOrder && SORT_ORDER.includes(sortOrder) ? (sortOrder as SortOrder) : 'asc'
  return { sortBy: by, sortOrder: order }
}

function normalizeParentId(parentId?: string | null): string | null | undefined {
  if (parentId === undefined) return undefined
  if (parentId === null) return null
  const trimmed = parentId.trim()
  return trimmed || null
}

@Injectable()
export class FolderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cleanupService: KbCleanupService,
    private readonly documentService: DocumentService,
  ) {}

  async list(
    userId: string,
    kbId: string,
    parentId?: string,
    sortBy?: string,
    sortOrder?: string,
  ) {
    await this.ensureOwnership(userId, kbId)

    const { sortBy: by, sortOrder: order } = parseFolderSort(sortBy, sortOrder)
    const effectiveParentId = normalizeParentId(parentId)

    return this.prisma.folder.findMany({
      where: {
        kbId,
        parentId: effectiveParentId ?? null,
      },
      orderBy: { [by]: order },
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

  async move(userId: string, kbId: string, folderId: string, dto: MoveFolderDto) {
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

    const targetKbId = dto.targetKbId ?? kbId
    if (targetKbId !== kbId) {
      throw new BadRequestException({
        code: 'NOT_SUPPORTED',
        message: '跨知识库移动文件夹尚未支持',
      })
    }

    const targetFolderId = dto.targetFolderId ?? null

    if (targetFolderId !== null) {
      if (targetFolderId === folderId) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: '不能将文件夹移动到自身',
        })
      }

      const targetFolder = await this.prisma.folder.findFirst({
        where: { id: targetFolderId, kbId: targetKbId },
      })
      if (!targetFolder) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: '目标文件夹不存在',
        })
      }

      const isMovingToDescendant = await this.isDescendant(folderId, targetFolderId)
      if (isMovingToDescendant) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: '不能将文件夹移动到其子文件夹中',
        })
      }
    }

    return this.prisma.folder.update({
      where: { id: folderId },
      data: {
        kbId: targetKbId,
        parentId: targetFolderId,
      },
    })
  }

  async copy(userId: string, kbId: string, folderId: string, dto: CopyFolderDto) {
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

    const targetKbId = dto.targetKbId ?? kbId
    if (targetKbId !== kbId) {
      throw new BadRequestException({
        code: 'NOT_SUPPORTED',
        message: '跨知识库复制文件夹尚未支持',
      })
    }

    const targetFolderId = dto.targetFolderId ?? null
    if (targetFolderId !== null) {
      const targetFolder = await this.prisma.folder.findFirst({
        where: { id: targetFolderId, kbId: targetKbId },
      })
      if (!targetFolder) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: '目标文件夹不存在',
        })
      }
    }

    const copiedRoot = await this.copyTree(userId, kbId, folderId, targetKbId, targetFolderId)
    return copiedRoot
  }

  private async copyTree(
    userId: string,
    srcKbId: string,
    srcFolderId: string,
    targetKbId: string,
    targetParentId: string | null,
  ) {
    const sourceRoot = await this.prisma.folder.findUnique({ where: { id: srcFolderId } })
    if (!sourceRoot) throw new NotFoundException('源文件夹不存在')

    const folderMap = new Map<string, string>()
    const stack: Array<{ id: string; parentId: string | null }> = [
      { id: sourceRoot.id, parentId: targetParentId },
    ]
    let copiedRootId: string | null = null

    while (stack.length > 0) {
      const { id: currentId, parentId: currentParentId } = stack.pop()!
      const sourceFolder = await this.prisma.folder.findUnique({ where: { id: currentId } })
      if (!sourceFolder) continue

      const newName = await this.resolveUniqueFolderName(targetKbId, currentParentId, sourceFolder.name)
      const copiedFolder = await this.prisma.folder.create({
        data: {
          kbId: targetKbId,
          parentId: currentParentId,
          name: newName,
        },
      })
      folderMap.set(currentId, copiedFolder.id)
      if (copiedRootId === null) copiedRootId = copiedFolder.id

      await this.copyDocumentsInFolder(userId, srcKbId, currentId, targetKbId, copiedFolder.id)

      const children = await this.prisma.folder.findMany({
        where: { parentId: currentId },
        select: { id: true },
      })
      for (const child of children) {
        stack.push({ id: child.id, parentId: copiedFolder.id })
      }
    }

    if (!copiedRootId) throw new BadRequestException('文件夹复制失败')
    return this.prisma.folder.findUnique({ where: { id: copiedRootId } })
  }

  private async copyDocumentsInFolder(
    userId: string,
    srcKbId: string,
    srcFolderId: string,
    targetKbId: string,
    targetFolderId: string,
  ) {
    const docs = await this.prisma.document.findMany({
      where: { kbId: srcKbId, folderId: srcFolderId },
      select: { id: true },
    })

    for (const doc of docs) {
      await this.documentService.copy(userId, srcKbId, doc.id, {
        targetKbId,
        targetFolderId,
      })
    }
  }

  private async resolveUniqueFolderName(
    kbId: string,
    parentId: string | null,
    baseName: string,
  ): Promise<string> {
    const existing = await this.prisma.folder.findMany({
      where: { kbId, parentId },
      select: { name: true },
    })
    const existingNames = new Set(existing.map((f) => f.name))
    if (!existingNames.has(baseName)) return baseName

    let index = 1
    while (existingNames.has(`${baseName} (${index})`)) {
      index++
    }
    return `${baseName} (${index})`
  }

  async getBreadcrumbs(
    userId: string,
    kbId: string,
    folderId?: string,
  ): Promise<Array<{ id: string; name: string; parentId: string | null }>> {
    await this.ensureOwnership(userId, kbId)

    if (!folderId) {
      return []
    }

    const folder = await this.prisma.folder.findFirst({
      where: { id: folderId, kbId },
    })
    if (!folder) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '文件夹不存在',
      })
    }

    return this.findAncestors(folderId)
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
