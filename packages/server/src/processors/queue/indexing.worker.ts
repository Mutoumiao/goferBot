import { Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { ZodError } from 'zod'
import type { DocumentJobData } from '../../queue/queues.js'
import { PrismaService } from '../database/prisma.service.js'
import { DocumentParser } from '../parser/document.parser.js'
import type { ParseResult } from '../parser/parser.types.js'
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

    const kb = doc.kbId
      ? await this.prisma.knowledgeBase.findUnique({ where: { id: doc.kbId } })
      : null
    const ownerUserId = kb?.userId

    const buffer = await this.storage.downloadFile(doc.storageKey)
    const mimeType = doc.mimeType ?? 'text/plain'

    // 使用策略模式分派解析器：可能返回文本型或结构化型结果
    const parsed = await this.parser.parse({
      buffer,
      mimeType,
      filename: doc.name,
    })

    try {
      // H10: 合并状态更新为单次 DB 写，减少数据库往返
      await this.updateStatus(doc.id, 'indexing')

      // 把解析器输出的结构信息传递给 RAG 服务
      //   - documentTitle：用作文档级元数据与 Contextual Embedding
      //   - sectionPath：用作文档层级路径
      //   - sections：结构化章节列表（由 RAG 服务决定使用结构化还是平级分块）
      const result = await this.ragService.indexDocument(
        doc.id,
        doc.kbId,
        parsed.content,
        undefined, // chunkSize：使用默认
        undefined, // overlap：使用默认
        {
          ...(parsed.metadata ?? {}),
          source_mime: mimeType,
          parser_name: parsed.metadata?.parser ?? 'legacy',
        },
        {
          documentTitle: parsed.title,
          // 选择第一个顶层 section 的 heading 作为章节路径（可后续升级为完整路径）
          sectionPath: this.resolveSectionPath(parsed),
          userId: ownerUserId,
          allowedUserIds: ownerUserId ? [ownerUserId] : undefined,
        },
      )

      await this.updateStatus(doc.id, 'ready')
      this.logger.log(
        `Indexed document ${documentId}: ${result.totalChunks} chunks (source=${mimeType})`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // ponytail: ZodError 单独处理——说明输入或解析结果违反了契约，
      // 应该记录详细的 issues 以便定位，而不是简单地吞掉错误信息。
      const details =
        err instanceof ZodError
          ? ` | schema=${err.issues.map((i) => `${i.path.join('.')}:${i.message}`).join(';')}`
          : ''
      this.logger.error(`Indexing failed for document ${documentId}: ${message}${details}`)
      await this.updateStatus(doc.id, 'failed', `${message}${details}`)
      throw err
    }
  }

  /** 从解析结果中选取合适的 sectionPath 用于 Contextual Embedding */
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
      data: { status, ...(errorMessage && { errorMessage }) },
    })
  }
}
