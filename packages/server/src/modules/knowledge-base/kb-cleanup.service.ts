import { Injectable, Logger } from '@nestjs/common'
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
    const documents = await this.prisma.document.findMany({
      where: { kbId },
      select: { id: true, storageKey: true },
    })

    for (const doc of documents) {
      await this.cleanupDocument(doc.id, doc.storageKey)
    }
  }

  async cleanupFolder(kbId: string, folderId: string): Promise<void> {
    // 使用显式栈遍历 folder 树，避免深层嵌套导致调用栈溢出。
    // folder 记录本身由调用方通过 Prisma 级联删除（Folder.parent/children 已声明 onDelete: Cascade）。
    const stack: string[] = [folderId]

    while (stack.length > 0) {
      const currentFolderId = stack.pop()
      if (!currentFolderId) break

      const documents = await this.prisma.document.findMany({
        where: { kbId, folderId: currentFolderId },
        select: { id: true, storageKey: true },
      })

      for (const doc of documents) {
        await this.cleanupDocument(doc.id, doc.storageKey)
      }

      const children = await this.prisma.folder.findMany({
        where: { parentId: currentFolderId },
        select: { id: true },
      })

      for (const child of children) {
        stack.push(child.id)
      }
    }
  }

  async cleanupDocument(documentId: string, storageKey?: string | null): Promise<void> {
    const chunks = await this.prisma.chunk.findMany({
      where: { documentId },
      select: { id: true },
    })

    if (chunks.length > 0) {
      // C5: 向量删除失败时重试一次，仍失败则标记孤儿数据
      let vectorDeleted = false
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await this.vectorService.deleteByIds(chunks.map((c) => c.id))
          vectorDeleted = true
          break
        } catch (err) {
          this.logger.warn(
            `文档 ${documentId} 的向量数据清理失败（尝试 ${attempt}/2）`,
            err instanceof Error ? err.stack : String(err),
          )
          if (attempt === 2) {
            this.logger.error(
              `文档 ${documentId} 的向量数据清理最终失败，产生孤儿向量数据。chunkIds=${chunks.map((c) => c.id).join(',')}`,
            )
          }
        }
      }
      if (!vectorDeleted) {
        // 标记孤儿数据：记录到日志，便于后续定期清理任务扫描
        this.logger.warn(`ORPHAN_VECTOR: documentId=${documentId} chunkCount=${chunks.length}`)
      }
    }

    if (storageKey) {
      try {
        await this.storage.deleteFile(storageKey)
      } catch (err) {
        this.logger.warn(
          `文档 ${documentId} 的存储文件 ${storageKey} 删除失败`,
          err instanceof Error ? err.stack : String(err),
        )
      }
    }
  }
}
