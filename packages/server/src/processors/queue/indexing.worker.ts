import { Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { PrismaService } from '../database/prisma.service.js'
import { VectorService } from '../vector/vector.service.js'
import { StorageService } from '../storage/storage.service.js'
import { ConfigService } from '@nestjs/config'
import { DocumentParser } from '../parser/document.parser.js'
import { PrismaMilvusIndexer } from '../indexing/prisma-milvus.indexer.js'
import { runIndexing, OpenAIEmbedder, RecursiveCharacterChunker } from '@goferbot/rag-sdk'
import type { DocumentJobData } from '../../queue/queues.js'

type DocumentStatus = 'uploaded' | 'chunking' | 'embedding' | 'indexing' | 'ready' | 'failed'

@Injectable()
export class IndexingWorker {
  private readonly logger = new Logger(IndexingWorker.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorService: VectorService,
    private readonly storage: StorageService,
    private readonly parser: DocumentParser,
    private readonly indexer: PrismaMilvusIndexer,
    private readonly config: ConfigService,
  ) {}

  async handleIndexJob(job: Job<DocumentJobData>): Promise<void> {
    const { documentId } = job.data
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } })
    if (!doc) throw new Error(`Document not found: ${documentId}`)

    const buffer = await this.storage.downloadFile(doc.storageKey)
    const text = await this.parser.parse(buffer, doc.mimeType)

    const embedder = new OpenAIEmbedder({
      apiKey: this.config.getOrThrow<string>('EMBEDDING_API_KEY'),
      baseUrl: this.config.get<string>('EMBEDDING_BASE_URL'), // 可选，默认 OpenAI 官方
      model: this.config.get<string>('EMBEDDING_MODEL', 'text-embedding-3-small'),
      dimension: this.config.get<number>('EMBEDDING_DIMENSIONS', 1536),
    })
    const chunker = new RecursiveCharacterChunker()

    await runIndexing({
      documentId: doc.id,
      kbId: doc.kbId,
      content: text,
      mimeType: doc.mimeType,
    }, {
      chunker,
      embedder,
      indexer: this.indexer,
      onStageChange: async (stages) => {
        const map: Record<string, DocumentStatus> = {
          chunk: 'chunking',
          embed: 'embedding',
          index: 'indexing',
        }
        const running = stages.find(s => s.status === 'running')
        if (running && map[running.name]) {
          await this.updateStatus(doc.id, map[running.name])
        }
      },
    })

    await this.updateStatus(doc.id, 'ready')
  }

  private async updateStatus(docId: string, status: DocumentStatus, errorMessage?: string): Promise<void> {
    await this.prisma.document.update({
      where: { id: docId },
      data: { status, ...(errorMessage && { errorMessage }) },
    })
  }
}
