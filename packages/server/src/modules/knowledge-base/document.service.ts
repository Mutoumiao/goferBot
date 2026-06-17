import { Injectable, ForbiddenException, NotFoundException, BadRequestException, Optional, Logger } from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { StorageService } from '../../processors/storage/storage.service.js'
import { VectorService } from '../../processors/vector/vector.service.js'
import { QueueService } from '../../processors/queue/queue.service.js'
import type { CreateDocumentDto } from './dto/create-document.dto.js'
import type { UpdateDocumentDto } from './dto/update-document.dto.js'
import type { MoveDocumentDto } from './dto/move-document.dto.js'
import type { CopyDocumentDto } from './dto/copy-document.dto.js'
import { KbCleanupService } from './kb-cleanup.service.js'

const MAX_CROSS_KB_FILE_SIZE = 50 * 1024 * 1024 // 50MB

function normalizeDocSize(size: bigint | number | null): number | null {
  return size !== null ? Number(size) : null
}

export interface UploadFilePayload {
  filename: string
  ext: string
  mimeType: string
  size: number
  buffer: Buffer
  folderId: string | null
}

type SortOrder = 'asc' | 'desc'
type DocumentSortBy = 'name' | 'createdAt' | 'updatedAt' | 'size' | 'type'

const DOCUMENT_SORT_BY: readonly string[] = ['name', 'createdAt', 'updatedAt', 'size', 'type']
const SORT_ORDER: readonly string[] = ['asc', 'desc']

function parseDocumentSort(sortBy?: string, sortOrder?: string): { sortBy: DocumentSortBy; sortOrder: SortOrder } {
  const by = sortBy && DOCUMENT_SORT_BY.includes(sortBy) ? (sortBy as DocumentSortBy) : 'createdAt'
  const order = sortOrder && SORT_ORDER.includes(sortOrder) ? (sortOrder as SortOrder) : 'desc'
  return { sortBy: by, sortOrder: order }
}

function normalizeFolderId(folderId?: string | null): string | null | undefined {
  if (folderId === undefined) return undefined
  if (folderId === null) return null
  const trimmed = folderId.trim()
  return trimmed || null
}

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly vectorService: VectorService,
    private readonly cleanupService: KbCleanupService,
    @Optional() private readonly queueService?: QueueService,
  ) {}

  async list(
    userId: string,
    kbId: string,
    folderId?: string | null,
    sortBy?: string,
    sortOrder?: string,
  ) {
    await this.ensureOwnership(userId, kbId)

    const { sortBy: by, sortOrder: order } = parseDocumentSort(sortBy, sortOrder)
    const effectiveFolderId = normalizeFolderId(folderId)

    const orderBy = by === 'type'
      ? [{ ext: order }, { mimeType: order }]
      : { [by]: order }

    return this.prisma.document.findMany({
      where: { kbId, folderId: effectiveFolderId ?? null },
      orderBy,
    })
  }

  async upload(userId: string, kbId: string, payload: UploadFilePayload) {
    await this.ensureOwnership(userId, kbId)

    const storageKey = `${kbId}/${Date.now()}-${payload.filename}`
    await this.storage.uploadFile(payload.buffer, storageKey, payload.mimeType)

    const doc = await this.prisma.document.create({
      data: {
        kbId,
        folderId: payload.folderId,
        name: payload.filename,
        ext: payload.ext,
        mimeType: payload.mimeType,
        size: BigInt(payload.size),
        storageKey,
        status: 'uploaded',
      },
    })

    const queueHealthy = await this.queueService?.isHealthy()
    if (queueHealthy) {
      await this.queueService!.addDocumentJob(doc.id, 'index')
    }

    return { ...doc, size: doc.size !== null ? Number(doc.size) : null }
  }

  async create(userId: string, kbId: string, dto: CreateDocumentDto) {
    await this.ensureOwnership(userId, kbId)
    return this.prisma.document.create({
      data: {
        kbId,
        folderId: dto.folderId ?? null,
        name: dto.name,
        storageKey: `temp-${Date.now()}`,
      },
    })
  }

  async update(userId: string, kbId: string, docId: string, dto: UpdateDocumentDto) {
    await this.ensureOwnership(userId, kbId)
    const doc = await this.prisma.document.findUnique({ where: { id: docId } })
    if (!doc || doc.kbId !== kbId) throw new NotFoundException('文档不存在')

    const data: Partial<{ name: string; folderId: string | null }> = {}
    if (dto.name !== undefined) data.name = dto.name

    if (dto.folderId !== undefined) {
      const targetFolderId = normalizeFolderId(dto.folderId)
      if (targetFolderId === null) {
        data.folderId = null
      } else {
        const folder = await this.prisma.folder.findFirst({
          where: { id: targetFolderId, kbId },
        })
        if (!folder) {
          throw new NotFoundException({
            code: 'NOT_FOUND',
            message: '目标文件夹不存在',
          })
        }
        data.folderId = targetFolderId
      }
    }

    return this.prisma.document.update({
      where: { id: docId },
      data,
    })
  }

  async move(userId: string, kbId: string, docId: string, dto: MoveDocumentDto) {
    await this.ensureOwnership(userId, kbId)

    const doc = await this.prisma.document.findUnique({ where: { id: docId } })
    if (!doc || doc.kbId !== kbId) throw new NotFoundException('文档不存在')

    const targetKbId = dto.targetKbId ?? kbId
    if (targetKbId !== kbId) {
      await this.ensureOwnership(userId, targetKbId)
    }

    const targetFolderId = dto.targetFolderId ?? null
    if (targetFolderId !== null) {
      const folder = await this.prisma.folder.findFirst({
        where: { id: targetFolderId, kbId: targetKbId },
      })
      if (!folder) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: '目标文件夹不存在',
        })
      }
    }

    if (targetKbId === kbId) {
      const updated = await this.prisma.document.update({
        where: { id: docId },
        data: { folderId: targetFolderId },
      })
      return { ...updated, size: normalizeDocSize(updated.size) }
    }

    // 跨 KB 移动：重新上传文件到目标 KB
    const size = doc.size !== null ? Number(doc.size) : 0
    if (size > MAX_CROSS_KB_FILE_SIZE) {
      throw new BadRequestException({
        code: 'PAYLOAD_TOO_LARGE',
        message: '跨知识库移动文件大小不能超过 50MB',
      })
    }

    if (!doc.storageKey) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: '文档无存储对象，无法跨知识库移动',
      })
    }

    const buffer = await this.storage.downloadFile(doc.storageKey)
    const newStorageKey = `${targetKbId}/${Date.now()}-${doc.name}`
    await this.storage.uploadFile(buffer, newStorageKey, doc.mimeType || 'application/octet-stream')

    const oldStorageKey = doc.storageKey

    // 删除旧 chunk 记录（向量随文档级联删除或 cleanupDocument 清理）
    try {
      await this.prisma.chunk.deleteMany({ where: { documentId: docId } })
    } catch (e) {
      this.logger.warn(`文档 ${docId} 跨知识库移动时删除旧 chunk 记录失败`, e instanceof Error ? e.stack : undefined)
    }

    const updated = await this.prisma.document.update({
      where: { id: docId },
      data: {
        kbId: targetKbId,
        folderId: targetFolderId,
        storageKey: newStorageKey,
        status: 'uploaded',
      },
    })

    // 清理原 KB 的 storage 与 vector
    try {
      await this.cleanupService.cleanupDocument(docId, oldStorageKey)
    } catch (e) {
      this.logger.warn(`文档 ${docId} 跨知识库移动后清理原存储/向量失败`, e instanceof Error ? e.stack : undefined)
    }

    // 触发重新索引
    const queueHealthy = await this.queueService?.isHealthy()
    if (queueHealthy) {
      await this.queueService!.addDocumentJob(docId, 'index')
    }

    return { ...updated, size: normalizeDocSize(updated.size) }
  }

  async copy(userId: string, kbId: string, docId: string, dto: CopyDocumentDto) {
    await this.ensureOwnership(userId, kbId)

    const doc = await this.prisma.document.findUnique({ where: { id: docId } })
    if (!doc || doc.kbId !== kbId) throw new NotFoundException('文档不存在')

    const targetKbId = dto.targetKbId ?? kbId
    if (targetKbId !== kbId) {
      await this.ensureOwnership(userId, targetKbId)
    }

    const targetFolderId = dto.targetFolderId ?? null
    if (targetFolderId !== null) {
      const folder = await this.prisma.folder.findFirst({
        where: { id: targetFolderId, kbId: targetKbId },
      })
      if (!folder) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: '目标文件夹不存在',
        })
      }
    }

    if (targetKbId !== kbId) {
      const size = doc.size !== null ? Number(doc.size) : 0
      if (size > MAX_CROSS_KB_FILE_SIZE) {
        throw new BadRequestException({
          code: 'PAYLOAD_TOO_LARGE',
          message: '跨知识库复制文件大小不能超过 50MB',
        })
      }
    }

    if (!doc.storageKey) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: '文档无存储对象，无法复制',
      })
    }

    const buffer = await this.storage.downloadFile(doc.storageKey)
    const newStorageKey = `${targetKbId}/${Date.now()}-${doc.name}`
    await this.storage.uploadFile(buffer, newStorageKey, doc.mimeType || 'application/octet-stream')

    const copied = await this.prisma.document.create({
      data: {
        kbId: targetKbId,
        folderId: targetFolderId,
        name: doc.name,
        ext: doc.ext,
        mimeType: doc.mimeType,
        size: doc.size,
        storageKey: newStorageKey,
        status: 'uploaded',
      },
    })

    const queueHealthy = await this.queueService?.isHealthy()
    if (queueHealthy) {
      await this.queueService!.addDocumentJob(copied.id, 'index')
    }

    return { ...copied, size: normalizeDocSize(copied.size) }
  }

  async remove(userId: string, kbId: string, docId: string) {
    await this.ensureOwnership(userId, kbId)
    const doc = await this.prisma.document.findUnique({ where: { id: docId } })
    if (!doc || doc.kbId !== kbId) throw new NotFoundException('文档不存在')

    await this.cleanupService.cleanupDocument(doc.id, doc.storageKey)
    await this.prisma.document.delete({ where: { id: docId } })
    return { id: docId, deleted: true }
  }

  async preview(userId: string, kbId: string, docId: string) {
    await this.ensureOwnership(userId, kbId)

    const doc = await this.prisma.document.findUnique({ where: { id: docId } })
    if (!doc || doc.kbId !== kbId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '文档不存在' })
    }

    const textExts = new Set(['md', 'txt', 'html', 'csv', 'json'])
    if (doc.ext && textExts.has(doc.ext.toLowerCase())) {
      if (!doc.storageKey) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: '文档无存储对象' })
      }
      const buffer = await this.storage.downloadFile(doc.storageKey)
      return {
        type: 'text',
        mimeType: doc.mimeType || 'text/plain',
        content: buffer.toString('utf-8'),
      }
    }

    if (doc.ext === 'pdf') {
      return {
        type: 'pdf',
        mimeType: 'application/pdf',
        url: doc.storageKey ? this.storage.getUrl(doc.storageKey) : null,
      }
    }

    return {
      type: 'unsupported',
      mimeType: doc.mimeType || 'application/octet-stream',
      url: doc.storageKey ? this.storage.getUrl(doc.storageKey) : null,
    }
  }

  private async ensureOwnership(userId: string, kbId: string) {
    const kb = await this.prisma.knowledgeBase.findUnique({
      where: { id: kbId },
      select: { userId: true },
    })
    if (!kb) throw new NotFoundException('知识库不存在')
    if (kb.userId !== userId) throw new ForbiddenException('无权访问')
  }
}
