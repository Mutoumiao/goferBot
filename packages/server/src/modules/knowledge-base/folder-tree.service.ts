import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { KbRepository } from './repositories/kb.repository.js'

type SortOrder = 'asc' | 'desc'
type FolderSortBy = 'name' | 'createdAt' | 'updatedAt'

const FOLDER_SORT_BY: readonly string[] = ['name', 'createdAt', 'updatedAt']
const SORT_ORDER: readonly string[] = ['asc', 'desc']

export function parseFolderSort(
  sortBy?: string,
  sortOrder?: string,
): { sortBy: FolderSortBy; sortOrder: SortOrder } {
  const by = sortBy && FOLDER_SORT_BY.includes(sortBy) ? (sortBy as FolderSortBy) : 'createdAt'
  const order = sortOrder && SORT_ORDER.includes(sortOrder) ? (sortOrder as SortOrder) : 'asc'
  return { sortBy: by, sortOrder: order }
}

export function normalizeParentId(parentId?: string | null): string | null | undefined {
  if (parentId === undefined) return undefined
  if (parentId === null) return null
  const trimmed = parentId.trim()
  return trimmed || null
}

@Injectable()
export class FolderTreeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kbRepository: KbRepository,
  ) {}

  async ensureOwnership(userId: string, kbId: string) {
    const kb = await this.kbRepository.findById(kbId)
    if (!kb) throw new NotFoundException({ code: 'NOT_FOUND', message: '知识库不存在' })
    if (kb.userId !== userId)
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权访问该资源' })
  }

  async list(userId: string, kbId: string, parentId?: string, sortBy?: string, sortOrder?: string) {
    await this.ensureOwnership(userId, kbId)
    const { sortBy: by, sortOrder: order } = parseFolderSort(sortBy, sortOrder)
    const effectiveParentId = normalizeParentId(parentId)

    return this.prisma.folder.findMany({
      where: { kbId, parentId: effectiveParentId ?? null },
      orderBy: { [by]: order },
    })
  }

  async create(userId: string, kbId: string, dto: { parentId?: string | null; name: string }) {
    await this.ensureOwnership(userId, kbId)

    if (dto.parentId) {
      const parent = await this.prisma.folder.findFirst({ where: { id: dto.parentId, kbId } })
      if (!parent) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: '父文件夹不存在' })
      }
    }

    return this.prisma.folder.create({
      data: { kbId, parentId: dto.parentId ?? null, name: dto.name },
    })
  }

  async update(userId: string, kbId: string, folderId: string, dto: { name: string }) {
    await this.ensureOwnership(userId, kbId)
    const folder = await this.prisma.folder.findFirst({ where: { id: folderId, kbId } })
    if (!folder) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '文件夹不存在' })
    }
    return this.prisma.folder.update({ where: { id: folderId }, data: { name: dto.name } })
  }

  async remove(userId: string, kbId: string, folderId: string) {
    await this.ensureOwnership(userId, kbId)
    const folder = await this.prisma.folder.findFirst({ where: { id: folderId, kbId } })
    if (!folder) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '文件夹不存在' })
    }
    return folder
  }

  async getById(userId: string, kbId: string, folderId: string) {
    await this.ensureOwnership(userId, kbId)
    return this.prisma.folder.findFirst({ where: { id: folderId, kbId } })
  }

  async getBreadcrumbs(userId: string, kbId: string, folderId?: string) {
    await this.ensureOwnership(userId, kbId)
    if (!folderId) return []
    const folder = await this.prisma.folder.findFirst({ where: { id: folderId, kbId } })
    if (!folder) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '文件夹不存在' })
    }
    return this.findAncestors(kbId, folderId)
  }

  async findAncestors(
    kbId: string,
    folderId: string,
  ): Promise<Array<{ id: string; name: string; parentId: string | null }>> {
    // 表名/列名对齐 Prisma @@map：folders / parent_id / kb_id
    const result = (await this.prisma.$queryRaw`
      WITH RECURSIVE ancestors AS (
        SELECT id, name, parent_id AS "parentId"
        FROM folders
        WHERE id = ${folderId} AND kb_id = ${kbId}
        UNION ALL
        SELECT f.id, f.name, f.parent_id AS "parentId"
        FROM folders f
        INNER JOIN ancestors a ON f.id = a."parentId"
        WHERE f.kb_id = ${kbId}
      )
      SELECT id, name, "parentId" FROM ancestors
    `) as Array<{ id: string; name: string; parentId: string | null }>
    return result.reverse()
  }

  async isDescendant(kbId: string, ancestorId: string, descendantId: string): Promise<boolean> {
    const result = (await this.prisma.$queryRaw`
      WITH RECURSIVE descendants AS (
        SELECT id, parent_id AS "parentId"
        FROM folders
        WHERE id = ${descendantId} AND kb_id = ${kbId}
        UNION ALL
        SELECT f.id, f.parent_id AS "parentId"
        FROM folders f
        INNER JOIN descendants d ON f.id = d."parentId"
        WHERE f.kb_id = ${kbId}
      )
      SELECT 1 as found FROM descendants WHERE id = ${ancestorId} AND id != ${descendantId}
      LIMIT 1
    `) as Array<{ found: number }>
    return result.length > 0
  }

  async resolveUniqueFolderName(
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

  async assertNotSelfOrDescendant(kbId: string, folderId: string, targetFolderId: string | null) {
    if (targetFolderId === null) return
    if (targetFolderId === folderId) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '不能将文件夹移动到自身' })
    }
    const targetFolder = await this.prisma.folder.findFirst({ where: { id: targetFolderId, kbId } })
    if (!targetFolder) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '目标文件夹不存在' })
    }
    const isMovingToDescendant = await this.isDescendant(kbId, folderId, targetFolderId)
    if (isMovingToDescendant) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '不能将文件夹移动到其子文件夹中',
      })
    }
  }
}
