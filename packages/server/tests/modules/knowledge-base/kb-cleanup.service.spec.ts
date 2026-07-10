import { ServiceUnavailableException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { KbCleanupService } from '@/modules/knowledge-base/kb-cleanup.service.js'
import type { KnowledgeAiClient } from '@/processors/knowledge-ai/knowledge-ai.client.js'
import type { PrismaService } from '@/processors/database/prisma.service.js'
import type { StorageService } from '@/processors/storage/storage.service.js'

describe('KbCleanupService', () => {
  let service: KbCleanupService
  let prisma: {
    document: { findMany: ReturnType<typeof vi.fn> }
    folder: { findMany: ReturnType<typeof vi.fn> }
    knowledgeBase: { delete: ReturnType<typeof vi.fn> }
    $transaction: ReturnType<typeof vi.fn>
  }
  let storage: { deleteFile: ReturnType<typeof vi.fn> }
  let knowledgeAi: {
    deleteDocument: ReturnType<typeof vi.fn>
    deleteKb: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    prisma = {
      document: { findMany: vi.fn() },
      folder: { findMany: vi.fn() },
      knowledgeBase: { delete: vi.fn() },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
        const tx = {
          chunk: { deleteMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
          document: { deleteMany: vi.fn(), delete: vi.fn() },
          folder: { delete: vi.fn() },
          knowledgeBase: { delete: vi.fn() },
        }
        await fn(tx)
        return tx
      }),
    }
    storage = { deleteFile: vi.fn().mockResolvedValue(undefined) }
    knowledgeAi = {
      deleteDocument: vi.fn().mockResolvedValue({ deleted: true }),
      deleteKb: vi.fn().mockResolvedValue({ deleted: true }),
    }
    service = new KbCleanupService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
      knowledgeAi as unknown as KnowledgeAiClient,
    )
  })

  it('cleanupDocument: KA 成功后才删业务数据', async () => {
    await service.cleanupDocument('doc-1', 's3/key')
    expect(knowledgeAi.deleteDocument).toHaveBeenCalledWith('doc-1')
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(storage.deleteFile).toHaveBeenCalledWith('s3/key')
  })

  it('cleanupDocument: KA 失败则阻断业务删除', async () => {
    knowledgeAi.deleteDocument.mockRejectedValue(new Error('upstream 503'))
    await expect(service.cleanupDocument('doc-1', 's3/key')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(storage.deleteFile).not.toHaveBeenCalled()
  })

  it('cleanupKnowledgeBase: KA 失败则阻断', async () => {
    prisma.document.findMany.mockResolvedValue([{ id: 'd1', storageKey: 'k1' }])
    knowledgeAi.deleteKb.mockRejectedValue(new Error('ka down'))
    await expect(service.cleanupKnowledgeBase('kb-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('cleanupFolder: 任一文档 KA 失败则阻断', async () => {
    prisma.document.findMany
      .mockResolvedValueOnce([{ id: 'd1', storageKey: 'k1' }])
      .mockResolvedValueOnce([])
    prisma.folder.findMany.mockResolvedValue([])
    knowledgeAi.deleteDocument.mockRejectedValueOnce(new Error('fail'))
    await expect(service.cleanupFolder('kb-1', 'folder-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
