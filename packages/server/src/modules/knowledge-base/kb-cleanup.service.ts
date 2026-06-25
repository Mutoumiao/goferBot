import { Injectable, Logger } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { StorageService } from '../../processors/storage/storage.service.js'
import { VectorService } from '../../processors/vector/vector.service.js'

@Injectable()
export class KbCleanupService {
  private readonly logger = new Logger(KbCleanupService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly vectorService: VectorService,
  ) {}

  async cleanupKnowledgeBase(kbId: string): Promise<void> {
    const docs = await this.prisma.document.findMany({
      where: { kbId },
      select: { id: true, storageKey: true },
    })

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const doc of docs) {
        await this.cleanupDocumentTx(tx, doc.id)
      }
      await tx.knowledgeBase.delete({ where: { id: kbId } })
    })

    // ponytail: 文件删除在事务外执行，避免外部存储失败导致事务回滚
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

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const stack: string[] = [folderId]

      while (stack.length > 0) {
        const currentFolderId = stack.pop()
        if (!currentFolderId) break

        const documents = await tx.document.findMany({
          where: { kbId, folderId: currentFolderId },
          select: { id: true, storageKey: true },
        })

        for (const doc of documents) {
          docs.push(doc)
          await this.cleanupDocumentTx(tx, doc.id)
        }

        const children = await tx.folder.findMany({
          where: { parentId: currentFolderId },
          select: { id: true },
        })

        for (const child of children) {
          stack.push(child.id)
        }
      }

      await tx.folder.delete({ where: { id: folderId } })
    })

    // ponytail: 文件删除在事务外执行
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
}
