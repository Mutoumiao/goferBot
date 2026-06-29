import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { buildStorageKey } from '../../common/utils/filename-sanitizer.js'
import { StorageService } from '../../processors/storage/storage.service.js'
import type { CopyDocumentDto } from './dto/copy-document.dto.js'
import type { MoveDocumentDto } from './dto/move-document.dto.js'
import { KbCleanupService } from './kb-cleanup.service.js'
import { DocumentRepository } from './repositories/document.repository.js'
import { FolderRepository } from './repositories/folder.repository.js'
import { KbRepository } from './repositories/kb.repository.js'

const MAX_CROSS_KB_FILE_SIZE = 50 * 1024 * 1024

@Injectable()
export class DocumentMoveService {
  private readonly logger = new Logger(DocumentMoveService.name)

  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly folderRepository: FolderRepository,
    private readonly kbRepository: KbRepository,
    private readonly storage: StorageService,
    private readonly cleanupService: KbCleanupService,
  ) {}

  async move(
    userId: string,
    kbId: string,
    docId: string,
    dto: MoveDocumentDto,
    reindex: (docId: string) => Promise<void>,
  ) {
    await this.ensureOwnership(userId, kbId)

    const doc = await this.documentRepository.findById(docId)
    if (!doc || doc.kbId !== kbId) throw new NotFoundException('文档不存在')

    const targetKbId = dto.targetKbId ?? kbId
    if (targetKbId !== kbId) {
      await this.ensureOwnership(userId, targetKbId)
    }

    const targetFolderId = dto.targetFolderId ?? null
    if (targetFolderId !== null) {
      const folder = await this.folderRepository.findByIdAndKb(targetFolderId, targetKbId)
      if (!folder) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: '目标文件夹不存在' })
      }
    }

    if (targetKbId === kbId) {
      return this.moveWithinKb(docId, targetFolderId)
    }
    return this.moveCrossKb(doc, targetKbId, targetFolderId, reindex)
  }

  private async moveWithinKb(docId: string, targetFolderId: string | null) {
    return this.documentRepository.update(docId, { folderId: targetFolderId })
  }

  private async moveCrossKb(
    doc: {
      id: string
      size: bigint | number | null
      storageKey: string | null
      name: string
      mimeType: string | null
    },
    targetKbId: string,
    targetFolderId: string | null,
    reindex: (docId: string) => Promise<void>,
  ) {
    const docId = doc.id
    this.assertCrossKbSize(doc)

    const { newStorageKey, oldStorageKey } = await this.reuploadForCrossKb(doc, targetKbId)

    try {
      await this.documentRepository.deleteChunksByDocumentId(docId)
    } catch (e) {
      this.logger.warn(
        `文档 ${docId} 跨知识库移动时删除旧 chunk 记录失败`,
        e instanceof Error ? e.stack : undefined,
      )
    }

    const updated = await this.documentRepository.update(docId, {
      kbId: targetKbId,
      folderId: targetFolderId,
      storageKey: newStorageKey,
      status: 'uploaded',
    })

    await this.cleanupOldStorageAfterMove(docId, oldStorageKey)
    await reindex(docId)

    return updated
  }

  private assertCrossKbSize(doc: { size: bigint | number | null }) {
    const size = doc.size !== null ? Number(doc.size) : 0
    if (size > MAX_CROSS_KB_FILE_SIZE) {
      throw new BadRequestException({
        code: 'PAYLOAD_TOO_LARGE',
        message: '跨知识库移动文件大小不能超过 50MB',
      })
    }
  }

  private async reuploadForCrossKb(
    doc: { storageKey: string | null; name: string; mimeType: string | null },
    targetKbId: string,
  ) {
    if (!doc.storageKey) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: '文档无存储对象，无法跨知识库移动',
      })
    }

    const MAX_IN_MEMORY_SIZE = 5 * 1024 * 1024
    const buffer = await this.storage.downloadFile(doc.storageKey)
    if (buffer.length > MAX_IN_MEMORY_SIZE) {
      this.logger.warn(
        `跨知识库移动大文件（${buffer.length} bytes），可能占用较多内存。doc=${doc.name}`,
      )
    }
    const { storageKey: newStorageKey } = buildStorageKey(targetKbId, doc.name)
    await this.storage.uploadFile(buffer, newStorageKey, doc.mimeType || 'application/octet-stream')

    return { newStorageKey, oldStorageKey: doc.storageKey }
  }

  private async cleanupOldStorageAfterMove(docId: string, oldStorageKey: string) {
    try {
      await this.cleanupService.cleanupDocument(docId, oldStorageKey)
    } catch (e) {
      this.logger.warn(
        `文档 ${docId} 跨知识库移动后清理原存储/向量失败`,
        e instanceof Error ? e.stack : undefined,
      )
    }
  }

  async copy(
    userId: string,
    kbId: string,
    docId: string,
    dto: CopyDocumentDto,
    enqueueReindex: (docId: string) => Promise<void>,
  ) {
    await this.ensureOwnership(userId, kbId)

    const doc = await this.documentRepository.findById(docId)
    if (!doc || doc.kbId !== kbId) throw new NotFoundException('文档不存在')

    const targetKbId = dto.targetKbId ?? kbId
    if (targetKbId !== kbId) {
      await this.ensureOwnership(userId, targetKbId)
    }

    const targetFolderId = dto.targetFolderId ?? null
    if (targetFolderId !== null) {
      const folder = await this.folderRepository.findByIdAndKb(targetFolderId, targetKbId)
      if (!folder) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: '目标文件夹不存在' })
      }
    }

    return this.copyDocument(doc, targetKbId, targetFolderId, targetKbId !== kbId, enqueueReindex)
  }

  private async copyDocument(
    doc: {
      id: string
      size: bigint | number | null
      storageKey: string | null
      name: string
      mimeType: string | null
      ext: string | null
    },
    targetKbId: string,
    targetFolderId: string | null,
    isCrossKb: boolean,
    enqueueReindex: (docId: string) => Promise<void>,
  ) {
    if (isCrossKb) {
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
    const { storageKey: newStorageKey, safeName } = buildStorageKey(targetKbId, doc.name)
    await this.storage.uploadFile(buffer, newStorageKey, doc.mimeType || 'application/octet-stream')

    const copied = await this.documentRepository.create({
      kbId: targetKbId,
      folderId: targetFolderId,
      name: safeName,
      ext: doc.ext,
      mimeType: doc.mimeType,
      size: doc.size !== null ? BigInt(doc.size) : null,
      storageKey: newStorageKey,
      status: 'uploaded',
    })

    await enqueueReindex(copied.id)

    return copied
  }

  async remove(userId: string, kbId: string, docId: string) {
    await this.ensureOwnership(userId, kbId)
    const doc = await this.documentRepository.findById(docId)
    if (!doc || doc.kbId !== kbId) throw new NotFoundException('文档不存在')

    await this.cleanupService.cleanupDocument(doc.id, doc.storageKey)
    await this.documentRepository.delete(docId)
    return { id: docId, deleted: true }
  }

  private async ensureOwnership(userId: string, kbId: string) {
    const kb = await this.kbRepository.findById(kbId)
    if (!kb) throw new NotFoundException('资源不存在或无权访问')
    if (kb.userId !== userId) throw new ForbiddenException('资源不存在或无权访问')
  }
}
