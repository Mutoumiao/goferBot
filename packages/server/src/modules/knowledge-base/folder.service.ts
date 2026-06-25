import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { DocumentService } from './document.service.js'
import type { CopyFolderDto } from './dto/copy-folder.dto.js'
import type { CreateFolderDto } from './dto/create-folder.dto.js'
import type { MoveFolderDto } from './dto/move-folder.dto.js'
import type { UpdateFolderDto } from './dto/update-folder.dto.js'
import { KbCleanupService } from './kb-cleanup.service.js'

type SortOrder = 'asc' | 'desc'
type FolderSortBy = 'name' | 'createdAt' | 'updatedAt'

const FOLDER_SORT_BY: readonly string[] = ['name', 'createdAt', 'updatedAt']
const SORT_ORDER: readonly string[] = ['asc', 'desc']

function parseFolderSort(
  sortBy?: string,
  sortOrder?: string,
): { sortBy: FolderSortBy; sortOrder: SortOrder } {
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
  private readonly logger = new Logger(FolderService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly cleanupService: KbCleanupService,
    private readonly documentService: DocumentService,
  ) {}

  async list(userId: string, kbId: string, parentId?: string, sortBy?: string, sortOrder?: string) {
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

  async update(userId: string, kbId: string, folderId: string, dto: UpdateFolderDto) {
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
    const targetFolderId = dto.targetFolderId ?? null

    if (targetKbId !== kbId) {
      return this.moveCrossKb(userId, kbId, folderId, targetKbId, targetFolderId)
    }
    return this.moveWithinKb(folderId, kbId, targetFolderId)
  }

  private async moveCrossKb(
    userId: string,
    srcKbId: string,
    folderId: string,
    targetKbId: string,
    targetFolderId: string | null,
  ) {
    await this.ensureOwnership(userId, targetKbId)

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

    const copiedRoot = await this.copyTree(userId, srcKbId, folderId, targetKbId, targetFolderId)

    await this.cleanupService.cleanupFolder(srcKbId, folderId)
    await this.prisma.folder.delete({ where: { id: folderId } })

    return copiedRoot
  }

  private async moveWithinKb(folderId: string, kbId: string, targetFolderId: string | null) {
    if (targetFolderId !== null) {
      if (targetFolderId === folderId) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: '不能将文件夹移动到自身',
        })
      }

      const targetFolder = await this.prisma.folder.findFirst({
        where: { id: targetFolderId, kbId },
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
        kbId,
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
      await this.ensureOwnership(userId, targetKbId)
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
    const sourceRoot = await this.prisma.folder.findFirst({
      where: { id: srcFolderId, kbId: srcKbId },
    })
    if (!sourceRoot) throw new NotFoundException('源文件夹不存在')

    const folderMap = await this.copyFolderNodesInTransaction(
      sourceRoot.id,
      targetKbId,
      targetParentId,
    )

    // 在事务外复制文档，确保目标 folder 已提交，DocumentService 能正常校验目标 folder。
    // C3: 添加补偿机制 — 文档复制失败时回滚已创建的 folder 树。
    const copiedFolderIds: string[] = []
    try {
      for (const [srcFolderId, copiedFolderId] of folderMap) {
        copiedFolderIds.push(copiedFolderId)
        await this.copyDocumentsInFolder(userId, srcKbId, srcFolderId, targetKbId, copiedFolderId)
      }
    } catch (err) {
      this.logger.warn(
        `文件夹复制失败，回滚已创建的 folder 树。targetKbId=${targetKbId} error=${err instanceof Error ? err.message : String(err)}`,
      )
      // 补偿：删除已创建的 folder 树（级联删除子 folder 和文档）
      for (const folderId of copiedFolderIds) {
        await this.prisma.folder.delete({ where: { id: folderId } }).catch(() => {
          // 忽略回滚失败，避免补偿失败阻塞
        })
      }
      throw new BadRequestException({
        code: 'COPY_FAILED',
        message: '文件夹复制失败，已回滚',
      })
    }

    const copiedRootId = folderMap.get(sourceRoot.id)
    if (!copiedRootId) throw new BadRequestException('文件夹复制失败')
    return this.prisma.folder.findUnique({ where: { id: copiedRootId } })
  }

  private async copyFolderNodesInTransaction(
    sourceRootId: string,
    targetKbId: string,
    targetParentId: string | null,
  ): Promise<Map<string, string>> {
    const folderMap = new Map<string, string>()
    // folder 树记录在事务内原子创建；文档复制涉及外部存储/向量，无法纳入同一事务。
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const stack: Array<{ id: string; parentId: string | null }> = [
        { id: sourceRootId, parentId: targetParentId },
      ]

      while (stack.length > 0) {
        const item = stack.pop()
        if (!item) continue
        const { id: currentId, parentId: currentParentId } = item
        const sourceFolder = await tx.folder.findUnique({ where: { id: currentId } })
        if (!sourceFolder) continue

        const newName = await this.resolveUniqueFolderName(
          targetKbId,
          currentParentId,
          sourceFolder.name,
          tx,
        )
        const copiedFolder = await tx.folder.create({
          data: {
            kbId: targetKbId,
            parentId: currentParentId,
            name: newName,
          },
        })
        folderMap.set(currentId, copiedFolder.id)

        const children = await tx.folder.findMany({
          where: { parentId: currentId },
          select: { id: true },
        })
        for (const child of children) {
          stack.push({ id: child.id, parentId: copiedFolder.id })
        }
      }
    })
    return folderMap
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
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const client = tx ?? this.prisma
    const existing = await client.folder.findMany({
      where: { kbId, parentId },
      select: { name: true },
    })
    const existingNames = new Set(existing.map((f: { name: string }) => f.name))
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

  async findAncestors(
    folderId: string,
  ): Promise<Array<{ id: string; name: string; parentId: string | null }>> {
    // H3: 使用递归 CTE 替代循环查询，避免 N+1 问题
    const result = (await this.prisma.$queryRaw`
      WITH RECURSIVE ancestors AS (
        SELECT id, name, "parentId"
        FROM "Folder"
        WHERE id = ${folderId}
        UNION ALL
        SELECT f.id, f.name, f."parentId"
        FROM "Folder" f
        INNER JOIN ancestors a ON f.id = a."parentId"
      )
      SELECT id, name, "parentId" FROM ancestors
    `) as Array<{ id: string; name: string; parentId: string | null }>
    return result.reverse()
  }

  async isDescendant(ancestorId: string, descendantId: string): Promise<boolean> {
    // H4: 使用递归 CTE 替代循环查询，避免 N+1 问题
    const result = (await this.prisma.$queryRaw`
      WITH RECURSIVE descendants AS (
        SELECT id, "parentId"
        FROM "Folder"
        WHERE id = ${descendantId}
        UNION ALL
        SELECT f.id, f."parentId"
        FROM "Folder" f
        INNER JOIN descendants d ON f.id = d."parentId"
      )
      SELECT 1 as found FROM descendants WHERE id = ${ancestorId} AND id != ${descendantId}
      LIMIT 1
    `) as Array<{ found: number }>
    return result.length > 0
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
