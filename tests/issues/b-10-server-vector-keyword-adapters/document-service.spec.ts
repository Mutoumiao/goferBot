import { describe, it, expect, vi } from 'vitest'
import { DocumentService } from '../../../packages/server/src/modules/knowledge-base/document.service.js'

describe('DocumentService.remove with vector deletion', () => {
  it('AC-08: remove calls deleteByFileId before deleting document record', async () => {
    const mockPrisma = {
      knowledgeBase: { findUnique: vi.fn().mockResolvedValue({ userId: 'u1' }) },
      document: {
        findUnique: vi.fn().mockResolvedValue({ id: 'd1', kbId: 'kb1' }),
        delete: vi.fn().mockResolvedValue({}),
      },
    } as any
    const mockStorage = {} as any
    const mockVector = { deleteByFileId: vi.fn().mockResolvedValue(undefined) } as any

    const service = new DocumentService(mockPrisma, mockStorage, mockVector)
    await service.remove('u1', 'kb1', 'd1')

    expect(mockVector.deleteByFileId).toHaveBeenCalledWith('d1')
    expect(mockPrisma.document.delete).toHaveBeenCalledWith({ where: { id: 'd1' } })
    // 验证调用顺序：deleteByFileId 在 document.delete 之前
    const deleteCallOrder = mockVector.deleteByFileId.mock.invocationCallOrder[0]
    const docDeleteCallOrder = mockPrisma.document.delete.mock.invocationCallOrder[0]
    expect(deleteCallOrder).toBeLessThan(docDeleteCallOrder)
  })
})
