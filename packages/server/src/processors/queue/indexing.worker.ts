import { OpenAIEmbedder, RecursiveCharacterChunker, runIndexing } from '@goferbot/rag-sdk'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Job } from 'bullmq'
import type { DocumentJobData } from '../../queue/queues.js'
import { PrismaService } from '../database/prisma.service.js'
import { PrismaVectorIndexer } from '../indexing/prisma-vector.indexer.js'
import { DocumentParser } from '../parser/document.parser.js'
import { StorageService } from '../storage/storage.service.js'

type DocumentStatus = 'uploaded' | 'chunking' | 'embedding' | 'indexing' | 'ready' | 'failed'

@Injectable()
export class IndexingWorker {
  private readonly logger = new Logger(IndexingWorker.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly parser: DocumentParser,
    private readonly indexer: PrismaVectorIndexer,
    private readonly config: ConfigService,
  ) {}

  async handleIndexJob(job: Job<DocumentJobData>): Promise<void> {
    const { documentId } = job.data
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } })
    if (!doc) throw new Error(`Document not found: ${documentId}`)

    const buffer = await this.storage.downloadFile(doc.storageKey)
    const text = await this.parser.parse(buffer, doc.mimeType ?? 'text/plain')

    const embedder = new OpenAIEmbedder({
      provider: 'openai',
      apiKey: this.config.getOrThrow<string>('EMBEDDING_API_KEY'),
      baseUrl: this.config.get<string>('EMBEDDING_BASE_URL') ?? undefined,
      model: this.config.get<string>('EMBEDDING_MODEL', 'text-embedding-3-small'),
      dimension: this.config.get<number>('EMBEDDING_DIMENSIONS', 1536),
    })
    const chunker = new RecursiveCharacterChunker()

    try {
      await runIndexing(
        {
          documentId: doc.id,
          kbId: doc.kbId,
          content: text,
          mimeType: doc.mimeType ?? 'text/plain',
        },
        {
          chunker,
          embedder,
          indexer: this.indexer,
          onStageChange: async (stages) => {
            const map: Record<string, DocumentStatus> = {
              chunk: 'chunking',
              embed: 'embedding',
              index: 'indexing',
            }
            const running = stages.find((s) => s.status === 'running')
            if (running && map[running.name]) {
              await this.updateStatus(doc.id, map[running.name])
            }
          },
        },
      )

      await this.updateStatus(doc.id, 'ready')
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
