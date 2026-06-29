import { ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { DocumentMoveService } from './document-move.service.js'
import { DocumentPreviewService } from './document-preview.service.js'
import type { UploadFilePayload } from './document-upload.service.js'
import { DocumentUploadService } from './document-upload.service.js'
import type { CopyDocumentDto } from './dto/copy-document.dto.js'
import type { CreateDocumentDto } from './dto/create-document.dto.js'
import type { MoveDocumentDto } from './dto/move-document.dto.js'
import type { UpdateDocumentDto } from './dto/update-document.dto.js'
import type { DocUpdateData } from './repositories/document.repository.js'
import { DocumentRepository } from './repositories/document.repository.js'
import { FolderRepository } from './repositories/folder.repository.js'
import { KbRepository } from './repositories/kb.repository.js'

export type { UploadFilePayload }

type SortOrder = 'asc' | 'desc'
type DocumentSortBy = 'name' | 'createdAt' | 'updatedAt' | 'size' | 'type'

const DOCUMENT_SORT_BY: readonly string[] = ['name', 'createdAt', 'updatedAt', 'size', 'type']
const SORT_ORDER: readonly string[] = ['asc', 'desc']

function parseDocumentSort(
  sortBy?: string,
  sortOrder?: string,
): { sortBy: DocumentSortBy; sortOrder: SortOrder } {
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
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly folderRepository: FolderRepository,
    private readonly kbRepository: KbRepository,
    private readonly uploadService: DocumentUploadService,
    private readonly moveService: DocumentMoveService,
    private readonly previewService: DocumentPreviewService,
    @Optional() private readonly queueService?: { isHealthy: () => Promise<boolean> },
  ) {}

  async list(
    userId: string,
    kbId: string,
    folderId?: string | null,
    sortBy?: string,
    sortOrder?: string,
    page?: number,
    pageSize?: number,
  ) {
    await this.ensureOwnership(userId, kbId)

    const { sortBy: by, sortOrder: order } = parseDocumentSort(sortBy, sortOrder)
    const effectiveFolderId = normalizeFolderId(folderId)

    const orderBy:
      | Prisma.DocumentOrderByWithRelationInput
      | Prisma.DocumentOrderByWithRelationInput[] =
      by === 'type' ? [{ ext: order }, { mimeType: order }] : { [by]: order }

    const effectivePage = Math.max(1, page ?? 1)
    const effectivePageSize = Math.min(100, Math.max(1, pageSize ?? 20))

    const [items, total] = await Promise.all([
      this.documentRepository.findManyByKbIdWithPagination(
        kbId,
        effectiveFolderId ?? null,
        orderBy,
        (effectivePage - 1) * effectivePageSize,
        effectivePageSize,
      ),
      this.documentRepository.countByKbId(kbId, effectiveFolderId ?? null),
    ])

    return { items, total, page: effectivePage, pageSize: effectivePageSize }
  }

  async upload(userId: string, kbId: string, payload: UploadFilePayload) {
    return this.uploadService.upload(userId, kbId, payload)
  }

  async create(userId: string, kbId: string, dto: CreateDocumentDto) {
    return this.uploadService.create(userId, kbId, dto)
  }

  async update(userId: string, kbId: string, docId: string, dto: UpdateDocumentDto) {
    await this.ensureOwnership(userId, kbId)
    const doc = await this.documentRepository.findById(docId)
    if (!doc || doc.kbId !== kbId) throw new NotFoundException('文档不存在')

    const patch: DocUpdateData = {}
    if (dto.name !== undefined) patch.name = dto.name

    if (dto.folderId !== undefined) {
      const targetFolderId = normalizeFolderId(dto.folderId)
      if (targetFolderId === null) {
        patch.folderId = null
      } else if (targetFolderId) {
        const folder = await this.folderRepository.findByIdAndKb(targetFolderId, kbId)
        if (!folder) {
          throw new NotFoundException({ code: 'NOT_FOUND', message: '目标文件夹不存在' })
        }
        patch.folderId = targetFolderId
      }
    }

    return this.uploadService.update(userId, kbId, docId, patch)
  }

  async move(userId: string, kbId: string, docId: string, dto: MoveDocumentDto) {
    return this.moveService.move(userId, kbId, docId, dto, (id) =>
      this.uploadService.enqueueReindex(id),
    )
  }

  async copy(userId: string, kbId: string, docId: string, dto: CopyDocumentDto) {
    return this.moveService.copy(userId, kbId, docId, dto, (id) =>
      this.uploadService.enqueueReindex(id),
    )
  }

  async remove(userId: string, kbId: string, docId: string) {
    return this.moveService.remove(userId, kbId, docId)
  }

  async preview(userId: string, kbId: string, docId: string) {
    const doc = await this.documentRepository.findById(docId)
    if (!doc || doc.kbId !== kbId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '文档不存在' })
    }
    return this.previewService.preview(userId, kbId, doc)
  }

  private async ensureOwnership(userId: string, kbId: string) {
    const kb = await this.kbRepository.findById(kbId)
    if (!kb) throw new NotFoundException('知识库不存在')
    if (kb.userId !== userId) throw new ForbiddenException('无权访问')
  }
}
