import type { IKeywordStore, RetrievalCandidate } from '@goferbot/rag-sdk'
import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service.js'

@Injectable()
export class KeywordService implements IKeywordStore {
  private readonly logger = new Logger(KeywordService.name)
  private useChineseConfig = false

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.detectZhparser()
  }

  private async detectZhparser(): Promise<void> {
    try {
      const result = (await this.prisma.$queryRaw`
        SELECT extname FROM pg_extension WHERE extname = 'zhparser'
      `) as Array<{ extname: string }>
      this.useChineseConfig = result.length > 0
      if (this.useChineseConfig) {
        this.logger.log('zhparser detected, using chinese config')
      } else {
        this.logger.warn('zhparser not installed, falling back to simple config')
      }
    } catch (err) {
      this.logger.warn(
        `zhparser detection failed: ${err instanceof Error ? err.message : String(err)}`,
      )
      this.useChineseConfig = false
    } finally {
      ;(this as { configChecked?: boolean }).configChecked = true
    }
  }

  async search(query: string, kbIds: string[], topK?: number): Promise<RetrievalCandidate[]> {
    if (!query || query.trim() === '') return []
    if (!kbIds || kbIds.length === 0) return []

    const trimmedQuery = query.trim()
    // C7: 限制查询长度，防止超长输入导致性能问题或潜在注入
    const MAX_QUERY_LENGTH = 2000
    if (trimmedQuery.length > MAX_QUERY_LENGTH) {
      this.logger.warn(
        `Query length ${trimmedQuery.length} exceeds limit ${MAX_QUERY_LENGTH}, truncating`,
      )
    }
    const safeQuery = trimmedQuery.slice(0, MAX_QUERY_LENGTH)

    const config = this.useChineseConfig ? 'chinese' : 'simple'
    const limit = Math.min(topK ?? 10, 100)

    const results = (await this.prisma.$queryRaw`
      SELECT id, document_id, kb_id, content, chunk_index,
        ts_rank_cd(to_tsvector(${config}, content), plainto_tsquery(${config}, ${safeQuery})) as rank
      FROM chunks
      WHERE kb_id = ANY(${kbIds}::uuid[])
        AND to_tsvector(${config}, content) @@ plainto_tsquery(${config}, ${safeQuery})
      ORDER BY rank DESC
      LIMIT ${limit}
    `) as Array<{
      id: string
      document_id: string
      kb_id: string
      content: string
      chunk_index: number
      rank: number
    }>

    return results.map((r) => ({
      chunk: {
        id: r.id,
        documentId: r.document_id,
        kbId: r.kb_id,
        content: r.content,
        chunkIndex: r.chunk_index,
      },
      score: Math.min(1, Number(r.rank)),
      source: 'keyword' as const,
    }))
  }
}
