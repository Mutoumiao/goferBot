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

    const config = this.useChineseConfig ? 'chinese' : 'simple'
    const limit = topK ?? 10
    const trimmedQuery = query.trim()

    const results = (await this.prisma.$queryRaw`
      SELECT id, document_id, kb_id, content, chunk_index,
        ts_rank_cd(to_tsvector(${config}, content), plainto_tsquery(${config}, ${trimmedQuery})) as rank
      FROM chunks
      WHERE kb_id = ANY(${kbIds}::uuid[])
        AND to_tsvector(${config}, content) @@ plainto_tsquery(${config}, ${trimmedQuery})
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
