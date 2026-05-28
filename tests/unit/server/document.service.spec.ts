import { describe, it, expect, vi } from 'vitest'
import { DocumentService } from '../../../packages/server/src/modules/knowledge-base/document.service.js'

describe('DocumentService.upload triggers indexing', () => {
  it('AC-01: upload creates document and adds index job to queue', async () => {
    const mockPrisma = {
      knowledgeBase: { findUnique: vi.fn().mockResolvedValue({ userId: 'u1' }) },
      document: {
        create: vi.fn().mockResolvedValue({ id: 'd1', kbId: 'kb1', status: 'uploaded' }),
      },
    }
    const mockStorage = { uploadFile: vi.fn().mockResolvedValue(undefined) }
    const mockVector = { deleteByFileId: vi.fn() }
    const mockQueue = { addDocumentJob: vi.fn().mockResolvedValue({}) }

    const service = new DocumentService(mockPrisma, mockStorage, mockVector, mockQueue)
    await service.upload('u1', 'kb1', {
      filename: 'test.txt', ext: 'txt', mimeType: 'text/plain',
      size: 100, buffer: Buffer.from('hello'), folderId: null,
    })

    expect(mockQueue.addDocumentJob).toHaveBeenCalledWith('d1', 'index')
  })

  it('AC-09: upload succeeds even when queue is disabled', async () => {
    const mockPrisma = {
      knowledgeBase: { findUnique: vi.fn().mockResolvedValue({ userId: 'u1' }) },
      document: {
        create: vi.fn().mockResolvedValue({ id: 'd1', kbId: 'kb1', status: 'uploaded' }),
      },
    }
    const mockStorage = { uploadFile: vi.fn().mockResolvedValue(undefined) }
    const mockVector = { deleteByFileId: vi.fn() }

    const service = new DocumentService(mockPrisma, mockStorage, mockVector)
    // 无 QueueService 注入时 upload 不应抛异常
    await expect(service.upload('u1', 'kb1', {
      filename: 'test.txt', ext: 'txt', mimeType: 'text/plain',
      size: 100, buffer: Buffer.from('hello'), folderId: null,
    })).resolves.toBeDefined()
  })
})
