import { randomUUID } from 'node:crypto'
import { ForbiddenException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service.js'
import type { ChunkDocument } from './elasticsearch.service.js'
import { ElasticsearchService } from './elasticsearch.service.js'
import { LlamaIndexEmbeddingService } from './llamaindex-embedding.service.js'

const DEFAULT_PARENT_OVERLAP = 100
const DEFAULT_CHILD_OVERLAP = 20

export interface IndexingConfig {
  parentChunkSize: number
  childChunkSize: number
  contextualWindow: number
  enableContextualEmbedding: boolean
}

@Injectable()
export class RagIndexingService {
  private readonly logger = new Logger(RagIndexingService.name)
  private parentChunkSize = 800
  private childChunkSize = 150
  private contextualWindow = 1
  private enableContextualEmbedding = true

  constructor(
    private readonly es: ElasticsearchService,
    private readonly embeddings: LlamaIndexEmbeddingService,
    private readonly prisma: PrismaService,
  ) {}

  applyConfig(config: IndexingConfig): void {
    this.parentChunkSize = config.parentChunkSize
    this.childChunkSize = config.childChunkSize
    this.contextualWindow = Math.max(1, config.contextualWindow)
    this.enableContextualEmbedding = config.enableContextualEmbedding

    if (this.enableContextualEmbedding) {
      this.logger.log(`Contextual embedding enabled (window=${this.contextualWindow})`)
    }
  }

  async indexDocument(
    documentId: string,
    kbId: string,
    content: string,
    chunkSize?: number,
    overlap?: number,
    metadata?: Record<string, unknown>,
    options?: {
      childChunkSize?: number
      parentChild?: boolean
      allowedUserIds?: string[]
      allowedTeamIds?: string[]
      documentTitle?: string
      sectionPath?: string
      userId?: string
    },
  ): Promise<{ totalChunks: number }> {
    const userId = options?.userId
    const effectiveAllowedUserIds = options?.allowedUserIds ?? (userId ? [userId] : undefined)
    if (userId) {
      const ownedCount = await this.prisma.knowledgeBase.count({
        where: { id: kbId, userId },
      })
      if (ownedCount === 0) {
        this.logger.warn(`Permission denied: user ${userId} cannot index into kbId=${kbId}`)
        throw new ForbiddenException('无权向该知识库写入内容')
      }
    }

    const parentChunkSize = chunkSize ?? this.parentChunkSize
    const parentOverlap = overlap ?? DEFAULT_PARENT_OVERLAP
    const childChunkSize = options?.childChunkSize ?? this.childChunkSize
    const parentChild = options?.parentChild ?? true
    const allowedTeamIds = options?.allowedTeamIds
    const documentTitle = options?.documentTitle ?? (metadata?.title as string | undefined)
    const sectionPath = options?.sectionPath ?? (metadata?.section_path as string | undefined)

    this.logger.log(`[Upsert] deleting existing chunks for documentId=${documentId}`)
    await this.es.deleteByDocumentId(documentId)

    const sharedMeta = {
      metadata,
      allowed_user_ids: effectiveAllowedUserIds,
      allowed_team_ids: allowedTeamIds,
      document_title: documentTitle,
      section_path: sectionPath,
    }

    if (!parentChild) {
      const chunks = this.splitIntoChunks(content, parentChunkSize, parentOverlap)
      const embedTexts = this.buildEmbeddingTexts(chunks, documentTitle, sectionPath)
      const embeddings = await this.embeddings.embedBatch(embedTexts)

      const now = new Date().toISOString()
      const docs: ChunkDocument[] = chunks.map((text, i) => ({
        id: randomUUID(),
        document_id: documentId,
        kb_id: kbId,
        content: text,
        chunk_index: i,
        token_count: Math.ceil(text.length / 4),
        embedding: embeddings[i],
        ...sharedMeta,
        created_at: now,
        updated_at: now,
      }))

      await this.es.bulkIndex(docs)
      return { totalChunks: chunks.length }
    }

    const parentChunks = this.splitIntoChunks(content, parentChunkSize, parentOverlap)
    const now = new Date().toISOString()

    const allChildTexts: string[] = []
    const childMeta: Array<{ parentId: string; parentContent: string }> = []

    parentChunks.forEach((parentText, parentIdx) => {
      const parentId = `${documentId}-parent-${parentIdx}`
      const parentContent = parentText
      const childChunks = this.splitIntoChunks(parentText, childChunkSize, DEFAULT_CHILD_OVERLAP)

      childChunks.forEach((childText) => {
        allChildTexts.push(childText)
        childMeta.push({ parentId, parentContent })
      })
    })

    if (allChildTexts.length === 0) {
      return { totalChunks: 0 }
    }

    const embedTexts = this.buildEmbeddingTexts(allChildTexts, documentTitle, sectionPath)
    this.logger.debug(
      `Embedding ${allChildTexts.length} chunks (contextual=${this.enableContextualEmbedding})`,
    )
    const embeddings = await this.embeddings.embedBatch(embedTexts)

    const docs: ChunkDocument[] = allChildTexts.map((text, i) => ({
      id: randomUUID(),
      document_id: documentId,
      kb_id: kbId,
      content: text,
      chunk_index: i,
      token_count: Math.ceil(text.length / 4),
      embedding: embeddings[i],
      parent_id: childMeta[i].parentId,
      parent_content: childMeta[i].parentContent,
      ...sharedMeta,
      created_at: now,
      updated_at: now,
    }))

    await this.es.bulkIndex(docs)
    return { totalChunks: docs.length }
  }

  async removeDocument(documentId: string, userId?: string): Promise<void> {
    if (userId) {
      const kbIds = await this.es.getKbIdsByDocumentId(documentId)
      if (kbIds.length === 0) {
        this.logger.warn(
          `Permission check on delete: documentId=${documentId} not found or inaccessible`,
        )
        throw new ForbiddenException('无权删除该文档')
      }
      const ownedCount = await this.prisma.knowledgeBase.count({
        where: { id: { in: kbIds }, userId },
      })
      if (ownedCount === 0) {
        this.logger.warn(
          `Permission denied: user ${userId} cannot delete documentId=${documentId} (kbIds=${JSON.stringify(kbIds)})`,
        )
        throw new ForbiddenException('无权删除该文档')
      }
    }

    await this.es.deleteByDocumentId(documentId)
  }

  buildEmbeddingTexts(
    childTexts: string[],
    documentTitle?: string,
    sectionPath?: string,
  ): string[] {
    if (childTexts.length === 0) return childTexts

    const headerParts: string[] = []
    if (documentTitle) headerParts.push(`文档：${documentTitle}`)
    if (sectionPath) headerParts.push(`章节：${sectionPath}`)
    const header = headerParts.length > 0 ? `${headerParts.join(' | ')} | ` : ''

    if (!this.enableContextualEmbedding) {
      return childTexts.map((t) => `${header}正文：${t}`)
    }

    const window = this.contextualWindow
    return childTexts.map((current, idx) => {
      const prefixParts: string[] = []
      for (let w = 1; w <= window && idx - w >= 0; w++) {
        prefixParts.push(childTexts[idx - w])
      }
      const prefix = prefixParts.reverse().join(' ')

      const suffixParts: string[] = []
      for (let w = 1; w <= window && idx + w < childTexts.length; w++) {
        suffixParts.push(childTexts[idx + w])
      }
      const suffix = suffixParts.join(' ')

      return `${header}正文：${prefix} ${current} ${suffix}`.replace(/\s+/g, ' ').trim()
    })
  }

  splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
    if (!text) return []
    const result: string[] = []
    const normalized = text.replace(/\r\n/g, '\n')

    const paragraphs = normalized.split(/\n\s*\n/)
    let buffer = ''

    for (const para of paragraphs) {
      if (`${buffer}\n\n${para}`.length <= chunkSize) {
        buffer = buffer ? `${buffer}\n\n${para}` : para
        continue
      }

      if (buffer) {
        result.push(buffer.trim())
        const startIdx = Math.max(0, buffer.length - overlap)
        buffer = buffer.slice(startIdx)
      }

      if (para.length > chunkSize) {
        let pos = 0
        while (pos < para.length) {
          const end = Math.min(pos + chunkSize, para.length)
          let cut = end
          if (end < para.length) {
            const searchRange = para.slice(Math.max(pos, end - 100), end)
            const lastSentenceEnd = Math.max(
              searchRange.lastIndexOf('。'),
              searchRange.lastIndexOf('．'),
              searchRange.lastIndexOf('.'),
              searchRange.lastIndexOf('！'),
              searchRange.lastIndexOf('?'),
              searchRange.lastIndexOf('？'),
              searchRange.lastIndexOf('\n'),
            )
            if (lastSentenceEnd > 0) {
              cut = Math.max(pos, end - 100) + lastSentenceEnd + 1
            }
          }
          const piece = para.slice(pos, cut)
          if (piece.trim()) result.push(piece.trim())
          const nextPos = cut - overlap
          pos = nextPos > pos ? nextPos : cut
          if (pos >= para.length) break
        }
        buffer = ''
      } else {
        buffer = para
      }
    }

    if (buffer.trim()) result.push(buffer.trim())
    return result
  }
}
