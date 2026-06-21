import { Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import type { DocumentJobData } from '../../queue/queues.js'
import { PrismaService } from '../database/prisma.service.js'
import { DocumentParser } from '../parser/document.parser.js'
import { LlamaIndexRagService } from '../rag/llamaindex-rag.service.js'
import { StorageService } from '../storage/storage.service.js'

type DocumentStatus = 'uploaded' | 'chunking' | 'embedding' | 'indexing' | 'ready' | 'failed'

@Injectable()
export class IndexingWorker {
  private readonly logger = new Logger(IndexingWorker.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly parser: DocumentParser,
    private readonly ragService: LlamaIndexRagService,
  ) {}

  async handleIndexJob(job: Job<DocumentJobData>): Promise<void> {
    const { documentId } = job.data
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } })
    if (!doc) throw new Error(`Document not found: ${documentId}`)

    const buffer = await this.storage.downloadFile(doc.storageKey)
    const text = await this.parser.parse(buffer, doc.mimeType ?? 'text/plain')

    try {
      await this.updateStatus(doc.id, 'chunking')
      await this.updateStatus(doc.id, 'embedding')
      await this.updateStatus(doc.id, 'indexing')

      const result = await this.ragService.indexDocument(
        doc.id,
        doc.kbId,
        text,
      )

      await this.updateStatus(doc.id, 'ready')
      this.logger.log(`Indexed document ${documentId}: ${result.totalChunks} chunks`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.error(`Indexing failed for document ${documentId}: ${message}`)
      await this.updateStatus(doc.id, 'failed', message)
      throw err
    }
  }

  private async updateStatus(
    docId: string,
    status: DocumentStatus,
    errorMessage?: string,
  ): Promise<void> {
    await this.prisma.document.update({
      where: { id: docId },
      data: { status, ...(errorMessage && { errorMessage }) },
    })
  }
}
