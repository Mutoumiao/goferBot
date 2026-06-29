import { randomUUID } from 'node:crypto'
import { ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { buildStorageKey } from '../../common/utils/filename-sanitizer.js'
import { QueueService } from '../../processors/queue/queue.service.js'
import { StorageService } from '../../processors/storage/storage.service.js'
import type { CreateDocumentDto } from './dto/create-document.dto.js'
import { DocumentUploadedEvent } from './events/document-uploaded.event.js'
import type { DocUpdateData } from './repositories/document.repository.js'
import { DocumentRepository } from './repositories/document.repository.js'
import { KbRepository } from './repositories/kb.repository.js'

export interface UploadFilePayload {
  filename: string
  ext: string
  mimeType: string
  size: number
  buffer: Buffer
  folderId: string | null
}

@Injectable()
export class DocumentUploadService {
  private readonly logger = new Logger(DocumentUploadService.name)

  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly kbRepository: KbRepository,
    private readonly storage: StorageService,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly queueService?: QueueService,
  ) {}

  async upload(
    userId: string,
    kbId: string,
    payload: {
      filename: string
      ext: string
      mimeType: string
      size: number
      buffer: Buffer
      folderId: string | null
    },
  ) {
    await this.ensureOwnership(userId, kbId)

    const { storageKey, safeName } = buildStorageKey(kbId, payload.filename)
    await this.storage.uploadFile(payload.buffer, storageKey, payload.mimeType)

    const doc = await this.documentRepository.create({
      kbId,
      folderId: payload.folderId,
      name: safeName,
      ext: payload.ext,
      mimeType: payload.mimeType,
      size: BigInt(payload.size),
      storageKey,
      status: 'uploaded',
    })

    const queueHealthy = await this.queueService?.isHealthy()
    if (queueHealthy) {
      await this.eventEmitter.emitAsync(
        DocumentUploadedEvent.eventType,
        new DocumentUploadedEvent(doc.id, kbId, userId),
      )
    }

    return { ...doc, size: doc.size !== null ? Number(doc.size) : null }
  }

  async create(userId: string, kbId: string, dto: CreateDocumentDto) {
    await this.ensureOwnership(userId, kbId)
    return this.documentRepository.create({
      kbId,
      folderId: dto.folderId ?? null,
      name: dto.name,
      storageKey: `temp-${randomUUID()}`,
      status: 'uploaded',
    })
  }

  async update(userId: string, kbId: string, docId: string, patch: DocUpdateData) {
    await this.ensureOwnership(userId, kbId)
    return this.documentRepository.update(docId, patch)
  }

  async enqueueReindex(docId: string) {
    const queueHealthy = await this.queueService?.isHealthy()
    if (queueHealthy) {
      await this.queueService?.addDocumentJob(docId, 'index')
    }
  }

  private async ensureOwnership(userId: string, kbId: string) {
    const kb = await this.kbRepository.findById(kbId)
    if (!kb) throw new NotFoundException('资源不存在或无权访问')
    if (kb.userId !== userId) throw new ForbiddenException('资源不存在或无权访问')
  }
}
