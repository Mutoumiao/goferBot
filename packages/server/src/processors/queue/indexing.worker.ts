import { Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { ZodError } from 'zod'
import type { DocumentJobData } from '../../queue/queues.js'
import { PrismaService } from '../database/prisma.service.js'
import { DocumentParser } from '../parser/document.parser.js'
import type { ParseResult } from '../parser/parser.types.js'
import { KnowledgeAiClient } from '../knowledge-ai/knowledge-ai.client.js'
import { KnowledgeAiProviderResolver } from '../knowledge-ai/knowledge-ai.provider-resolver.js'
import { StorageService } from '../storage/storage.service.js'

type DocumentStatus = 'uploaded' | 'chunking' | 'embedding' | 'indexing' | 'ready' | 'failed'

/**
 * Document indexing worker: Nest extracts text → Knowledge AI POST /index.
 * Does NOT write Nest/pgvector/ES as the authority path (Python owns dual-store).
 */
@Injectable()
export class IndexingWorker {
  private readonly logger = new Logger(IndexingWorker.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly parser: DocumentParser,
    private readonly knowledgeAi: KnowledgeAiClient,
    private readonly providerResolver: KnowledgeAiProviderResolver,
  ) {}

  async handleIndexJob(job: Job<DocumentJobData>): Promise<void> {
    const { documentId } = job.data
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } })
    if (!doc) throw new Error(`Document not found: ${documentId}`)
    if (!doc.kbId) throw new Error(`Document ${documentId} has no kbId`)

    const kb = await this.prisma.knowledgeBase.findUnique({ where: { id: doc.kbId } })
    const ownerUserId = kb?.userId
    if (!ownerUserId) {
      throw new Error(`Knowledge base ${doc.kbId} has no owner; cannot resolve embedding provider`)
    }

    const buffer = await this.storage.downloadFile(doc.storageKey)
    const mimeType = doc.mimeType ?? 'text/plain'

    const parsed = await this.parser.parse({
      buffer,
      mimeType,
      filename: doc.name,
    })

    try {
      await this.updateStatus(doc.id, 'indexing')

      const provider = await this.providerResolver.resolveEmbeddingConfig(ownerUserId)
      const text = (parsed.content ?? '').trim()
      if (!text) {
        throw new Error('Parsed document text is empty; cannot index')
      }

      const result = await this.knowledgeAi.index({
        document_id: doc.id,
        kb_id: doc.kbId,
        text,
        metadata: {
          ...(parsed.metadata ?? {}),
          source_mime: mimeType,
          parser_name: parsed.metadata?.parser ?? 'legacy',
          document_title: parsed.title,
          section_path: this.resolveSectionPath(parsed),
          name: doc.name,
        },
        trace_id: `index-${documentId}-${job.id ?? 'job'}`,
        _provider: provider,
      })

      await this.updateStatus(doc.id, 'ready')
      this.logger.log(
        `Indexed document ${documentId} via Knowledge AI: ${result.chunk_count} chunks (source=${mimeType})`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const details =
        err instanceof ZodError
          ? ` | schema=${err.issues.map((i) => `${i.path.join('.')}:${i.message}`).join(';')}`
          : ''
      this.logger.error(`Indexing failed for document ${documentId}: ${message}${details}`)
      await this.updateStatus(doc.id, 'failed', `${message}${details}`.slice(0, 500))
      throw err
    }
  }

  private resolveSectionPath(parsed: ParseResult): string | undefined {
    if (parsed.hierarchyPath && parsed.hierarchyPath.length > 0) {
      return parsed.hierarchyPath.join(' / ')
    }
    const firstHeading = parsed.sections.find(
      (s: ParseResult['sections'][number]) => s.heading,
    )?.heading
    return firstHeading
  }

  private async updateStatus(
    docId: string,
    status: DocumentStatus,
    errorMessage?: string,
  ): Promise<void> {
    await this.prisma.document.update({
      where: { id: docId },
      data: {
        status,
        errorMessage: errorMessage ?? null,
      },
    })
  }
}
