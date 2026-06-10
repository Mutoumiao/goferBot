import { describe, it, expect, vi } from 'vitest'
import { DocumentService } from '@/modules/knowledge-base/document.service.js'

describe('DocumentService.remove with vector deletion', () => {
  it('AC-08: remove deletes document and relies on ON DELETE CASCADE for chunks', async () => {
    const mockPrisma = {
      knowledgeBase: { findUnique: vi.fn().mockResolvedValue({ userId: 'u1' }) },
      document: {
        findUnique: vi.fn().mockResolvedValue({ id: 'd1', kbId: 'kb1' }),
        delete: vi.fn().mockResolvedValue({}),
      },
    } as any
    const mockStorage = {} as any
    const mockVector = {} as any

    const service = new DocumentService(mockPrisma, mockStorage, mockVector)
    await service.remove('u1', 'kb1', 'd1')

    // ADR 0001 决策：deleteByFileId 已由数据库级 ON DELETE CASCADE 替代
    // DocumentService 不再显式调用向量删除
    expect(mockVector.deleteByFileId).toBeUndefined()
    expect(mockPrisma.document.delete).toHaveBeenCalledWith({ where: { id: 'd1' } })
  })
})
