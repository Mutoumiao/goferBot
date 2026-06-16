import { Injectable, ForbiddenException, NotFoundException, Optional } from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { StorageService } from '../../processors/storage/storage.service.js'
import { VectorService } from '../../processors/vector/vector.service.js'
import { QueueService } from '../../processors/queue/queue.service.js'
import type { CreateDocumentDto } from './dto/create-document.dto.js'
import type { UpdateDocumentDto } from './dto/update-document.dto.js'
import { KbCleanupService } from './kb-cleanup.service.js'

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

@Injectable()
export class DocumentService {
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
    sortBy: DocumentSortBy = 'createdAt',
    sortOrder: SortOrder = 'desc',
  ) {
    await this.ensureOwnership(userId, kbId)

    const orderBy = sortBy === 'type'
      ? [{ ext: sortOrder }, { mimeType: sortOrder }]
      : { [sortBy]: sortOrder }

    return this.prisma.document.findMany({
      where: { kbId, folderId: folderId ?? null },
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

    if (this.queueService?.isHealthy()) {
      await this.queueService.addDocumentJob(doc.id, 'index')
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
    return this.prisma.document.update({
      where: { id: docId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.folderId !== undefined && { folderId: dto.folderId }),
      },
    })
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
