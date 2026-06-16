import { describe, it, expect, vi } from 'vitest'
import { DocumentService } from '@/modules/knowledge-base/document.service.js'

describe('DocumentService.remove with cleanup', () => {
  it('AC-08: remove deletes document, storage and vector chunks', async () => {
    const mockPrisma = {
      knowledgeBase: { findUnique: vi.fn().mockResolvedValue({ userId: 'u1' }) },
      document: {
        findUnique: vi.fn().mockResolvedValue({ id: 'd1', kbId: 'kb1', storageKey: 'kb1/d1.txt' }),
        delete: vi.fn().mockResolvedValue({}),
      },
      chunk: {
        findMany: vi.fn().mockResolvedValue([{ id: 'c1' }]),
      },
    } as any
    const mockStorage = {
      deleteFile: vi.fn().mockResolvedValue(undefined),
    } as any
    const mockVector = {
      deleteByIds: vi.fn().mockResolvedValue(undefined),
    } as any
    const mockCleanup = {
      cleanupDocument: vi.fn().mockResolvedValue(undefined),
    } as any

    const service = new DocumentService(mockPrisma, mockStorage, mockVector, mockCleanup)
    await service.remove('u1', 'kb1', 'd1')

    expect(mockCleanup.cleanupDocument).toHaveBeenCalledWith('d1', 'kb1/d1.txt')
    expect(mockPrisma.document.delete).toHaveBeenCalledWith({ where: { id: 'd1' } })
  })
})
