import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { KnowledgeAiClient } from '../../processors/knowledge-ai/knowledge-ai.client.js'
import { StorageService } from '../../processors/storage/storage.service.js'

/**
 * Cascade cleanup for KB / folder / document.
 * Vector + BM25 authority lives in Knowledge AI (PG knowledge schema + ES);
 * Nest Chunk table is legacy and still cleared for local DB consistency.
 *
 * Fail-closed: Knowledge AI index purge MUST succeed before Nest deletes
 * business metadata (avoids orphan recallable vectors).
 */
@Injectable()
export class KbCleanupService {
  private readonly logger = new Logger(KbCleanupService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly knowledgeAi: KnowledgeAiClient,
  ) {}

  async cleanupKnowledgeBase(kbId: string): Promise<void> {
    const docs = await this.prisma.document.findMany({
      where: { kbId },
      select: { id: true, storageKey: true },
    })

    await this.purgeKbIndex(kbId)

    const docIds = docs.map((d) => d.id)
    if (docIds.length > 0) {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.chunk.deleteMany({ where: { documentId: { in: docIds } } })
        await tx.document.deleteMany({ where: { id: { in: docIds } } })
        await tx.knowledgeBase.delete({ where: { id: kbId } })
      })
    } else {
      await this.prisma.knowledgeBase.delete({ where: { id: kbId } })
    }

    for (const doc of docs) {
      if (doc.storageKey) {
        await this.storage.deleteFile(doc.storageKey).catch((err: unknown) => {
          this.logger.warn(
            `Storage delete failed for ${doc.storageKey}: ${err instanceof Error ? err.message : String(err)}`,
          )
        })
      }
    }
  }

  async cleanupFolder(kbId: string, folderId: string): Promise<void> {
    const docs: { id: string; storageKey?: string | null }[] = []
    const stack: string[] = [folderId]

    while (stack.length > 0) {
      const currentFolderId = stack.pop()
      if (!currentFolderId) continue

      const documents = await this.prisma.document.findMany({
        where: { kbId, folderId: currentFolderId },
        select: { id: true, storageKey: true },
      })
      docs.push(...documents)

      const children = await this.prisma.folder.findMany({
        where: { parentId: currentFolderId },
        select: { id: true },
      })
      for (const child of children) {
        stack.push(child.id)
      }
    }

    for (const doc of docs) {
      await this.purgeDocumentIndex(doc.id)
    }

    const docIds = docs.map((d) => d.id)
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (docIds.length > 0) {
        await tx.chunk.deleteMany({ where: { documentId: { in: docIds } } })
        await tx.document.deleteMany({ where: { id: { in: docIds } } })
      }
      await tx.folder.delete({ where: { id: folderId } })
    })

    for (const doc of docs) {
      if (doc.storageKey) {
        await this.storage.deleteFile(doc.storageKey).catch((err: unknown) => {
          this.logger.warn(
            `Storage delete failed for ${doc.storageKey}: ${err instanceof Error ? err.message : String(err)}`,
          )
        })
      }
    }
  }

  private async cleanupDocumentTx(tx: Prisma.TransactionClient, documentId: string): Promise<void> {
    const chunks = await tx.chunk.findMany({
      where: { documentId },
      select: { id: true },
    })
    if (chunks.length > 0) {
      await tx.chunk.deleteMany({ where: { documentId } })
    }
    await tx.document.delete({ where: { id: documentId } })
  }

  async cleanupDocument(documentId: string, storageKey?: string | null): Promise<void> {
    await this.purgeDocumentIndex(documentId)

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.cleanupDocumentTx(tx, documentId)
    })

    if (storageKey) {
      await this.storage.deleteFile(storageKey).catch((err: unknown) => {
        this.logger.warn(
          `Storage delete failed for ${storageKey}: ${err instanceof Error ? err.message : String(err)}`,
        )
      })
    }
  }

  private async purgeDocumentIndex(documentId: string): Promise<void> {
    try {
      await this.knowledgeAi.deleteDocument(documentId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`Knowledge AI DELETE /documents/${documentId} failed: ${msg}`)
      throw new ServiceUnavailableException({
        code: 'KNOWLEDGE_AI_PURGE_FAILED',
        message: '知识索引清理失败，业务数据未删除，请稍后重试',
      })
    }
  }

  private async purgeKbIndex(kbId: string): Promise<void> {
    try {
      await this.knowledgeAi.deleteKb(kbId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`Knowledge AI DELETE /kb/${kbId} failed: ${msg}`)
      throw new ServiceUnavailableException({
        code: 'KNOWLEDGE_AI_PURGE_FAILED',
        message: '知识库索引清理失败，业务数据未删除，请稍后重试',
      })
    }
  }
}
