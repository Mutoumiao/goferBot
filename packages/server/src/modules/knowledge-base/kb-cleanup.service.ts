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
    const documents = await this.prisma.document.findMany({
      where: { kbId, folderId },
      select: { id: true, storageKey: true },
    })

    for (const doc of documents) {
      await this.cleanupDocument(doc.id, doc.storageKey)
    }

    const children = await this.prisma.folder.findMany({
      where: { parentId: folderId },
      select: { id: true },
    })

    for (const child of children) {
      await this.cleanupFolder(kbId, child.id)
    }
  }

  async cleanupDocument(documentId: string, storageKey?: string | null): Promise<void> {
    const chunks = await this.prisma.chunk.findMany({
      where: { documentId },
      select: { id: true },
    })

    if (chunks.length > 0) {
      try {
        await this.vectorService.deleteByIds(chunks.map((c) => c.id))
      } catch {
        this.logger.warn(`文档 ${documentId} 的向量数据清理失败，继续清理存储与记录`)
      }
    }

    if (storageKey) {
      try {
        await this.storage.deleteFile(storageKey)
      } catch {
        this.logger.warn(`文档 ${documentId} 的存储文件 ${storageKey} 删除失败`)
      }
    }
  }
}
