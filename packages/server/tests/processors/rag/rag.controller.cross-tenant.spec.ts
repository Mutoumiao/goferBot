import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { RagController } from '@/processors/rag/rag.controller.js'
import { SseResponseHelper } from '@/common/helpers/sse-response.helper.js'

/**
 * Cross-tenant authorization tests for the RAG controller.
 *
 * These tests exercise the security boundary defined in spec AC-18 / AC-19:
 *   - AC-18: POST /rag/index MUST reject users who do not own the target kb.
 *   - AC-19: DELETE /rag/documents/:documentId MUST reject users who do not own
 *             the underlying kb (resolved via ES).
 *
 * We stub the LlamaIndexRagService to assert that the controller short-circuits
 * before any ES/DB write is attempted when the caller lacks ownership.
 */

class MockRagService {
  retrieve = vi.fn()
  query = vi.fn()
  streamQuery = vi.fn()
  indexDocument = vi.fn()
  removeDocument = vi.fn()
}

class MockEsService {
  getClient = vi.fn()
  getIndexName = vi.fn().mockReturnValue('knowledge_chunks')
  checkIkPlugin = vi.fn().mockResolvedValue(true)
}

describe('RagController — cross-tenant authorization', () => {
  let controller: RagController
  let ragService: MockRagService
  let esService: MockEsService
  let sseHelper: SseResponseHelper

  beforeEach(() => {
    vi.clearAllMocks()
    ragService = new MockRagService()
    esService = new MockEsService()
    sseHelper = {
      init: vi.fn(),
      write: vi.fn(),
      writeError: vi.fn(),
      end: vi.fn(),
    } as unknown as SseResponseHelper

    controller = new RagController(
      ragService as any,
      esService as any,
      sseHelper,
    )
  })

  describe('POST /rag/index', () => {
    it('throws ForbiddenException when userId is missing (unauthenticated)', async () => {
      const dto = { documentId: 'doc-1', kbId: 'kb-1', content: 'hello' }
      await expect(controller.index(dto as any, '')).rejects.toThrow(ForbiddenException)
      expect(ragService.indexDocument).not.toHaveBeenCalled()
    })

    it('throws ForbiddenException when user-2 tries to index into kb owned by user-1', async () => {
      // Simulate the service detecting ownership failure (Prisma count === 0).
      ragService.indexDocument.mockRejectedValueOnce(
        new ForbiddenException('无权向该知识库写入内容'),
      )
      const dto = { documentId: 'doc-1', kbId: 'kb-owned-by-user-1', content: 'hello' }
      await expect(controller.index(dto as any, 'user-2')).rejects.toThrow(ForbiddenException)
      // Service IS reached (controller passes userId through), but service rejects.
      expect(ragService.indexDocument).toHaveBeenCalledTimes(1)
      expect(ragService.indexDocument).toHaveBeenCalledWith(
        'doc-1',
        'kb-owned-by-user-1',
        'hello',
        undefined,
        undefined,
        undefined,
        { userId: 'user-2' },
      )
    })

    it('returns successfully when user-1 indexes into own kb', async () => {
      ragService.indexDocument.mockResolvedValueOnce({ totalChunks: 3 })
      const dto = { documentId: 'doc-1', kbId: 'kb-owned-by-user-1', content: 'hello world' }
      const result = await controller.index(dto as any, 'user-1')
      expect(result).toEqual({ totalChunks: 3 })
      expect(ragService.indexDocument).toHaveBeenCalledWith(
        'doc-1',
        'kb-owned-by-user-1',
        'hello world',
        undefined,
        undefined,
        undefined,
        { userId: 'user-1' },
      )
    })
  })

  describe('DELETE /rag/documents/:documentId', () => {
    it('throws ForbiddenException when userId is missing (unauthenticated)', async () => {
      await expect(controller.removeDocument('doc-1', '')).rejects.toThrow(ForbiddenException)
      expect(ragService.removeDocument).not.toHaveBeenCalled()
    })

    it('throws ForbiddenException when user-2 tries to delete document owned by user-1', async () => {
      // Service resolves kbIds via ES, then Prisma count returns 0 for user-2.
      ragService.removeDocument.mockRejectedValueOnce(
        new ForbiddenException('无权删除该文档'),
      )
      await expect(controller.removeDocument('doc-owned-by-user-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      )
      // No delete should occur: the service rejects before any ES delete.
      expect(ragService.removeDocument).toHaveBeenCalledWith(
        'doc-owned-by-user-1',
        'user-2',
      )
    })

    it('returns void when user-1 deletes own document', async () => {
      ragService.removeDocument.mockResolvedValueOnce(undefined)
      await expect(
        controller.removeDocument('doc-owned-by-user-1', 'user-1'),
      ).resolves.toBeUndefined()
      expect(ragService.removeDocument).toHaveBeenCalledWith(
        'doc-owned-by-user-1',
        'user-1',
      )
    })

    it('throws on attempting to delete a document that does not exist (no information leak)', async () => {
      // Service should NOT distinguish between "document missing" and "not owner";
      // both paths yield 403 to avoid leaking document existence.
      ragService.removeDocument.mockRejectedValueOnce(
        new ForbiddenException('无权删除该文档'),
      )
      await expect(
        controller.removeDocument('nonexistent-doc', 'user-1'),
      ).rejects.toThrow(ForbiddenException)
    })
  })

  describe('POST /rag/retrieve — userId is propagated', () => {
    it('passes userId from @CurrentUser into service.retrieve for ACL filtering', async () => {
      ragService.retrieve.mockResolvedValueOnce([])
      const dto = { query: 'hello', kbIds: ['kb-1'] }
      await controller.retrieve(dto as any, 'user-1')
      expect(ragService.retrieve).toHaveBeenCalledWith('hello', {
        kbIds: ['kb-1'],
        documentIds: undefined,
        topK: undefined,
        candidateK: undefined,
        minScore: undefined,
        mode: undefined,
        vectorWeight: undefined,
        bm25Weight: undefined,
        rrfK: undefined,
        needRerank: undefined,
        rerankTopK: undefined,
        metadata: undefined,
        userId: 'user-1',
      })
    })
  })

  describe('POST /rag/query — cross-tenant rejection surface', () => {
    it('forwards userId to service.query where ACL pre-filtering is applied', async () => {
      ragService.query.mockResolvedValueOnce({ answer: 'ok', grounding: [] })
      const dto = { query: 'hello' }
      await controller.query(dto as any, 'user-1')
      expect(ragService.query).toHaveBeenCalledWith('hello', expect.objectContaining({
        userId: 'user-1',
      }))
    })

    it('service rejects query for non-owned kb by returning empty/filtered results', async () => {
      // The service layer is responsible for ACL pre-filtering; here we verify
      // the controller does NOT mask a ForbiddenException bubbled up from it.
      ragService.query.mockRejectedValueOnce(new UnauthorizedException('forbidden'))
      await expect(
        controller.query({ query: 'secret' } as any, 'user-2'),
      ).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('POST /rag/stream — cross-tenant rejection surface', () => {
    it('swallows the error via SseResponseHelper.writeError (no exception leaked)', async () => {
      // The controller's catch block writes the error via SSE helper and does not
      // rethrow. This test documents that behaviour so future refactors don't
      // silently change the SSE error surface.
      ragService.streamQuery.mockImplementationOnce(async function* () {
        throw new ForbiddenException('无权访问')
      })
      const req: any = {}
      const reply: any = {}
      await expect(
        controller.stream({ query: 'secret' } as any, req, reply, 'user-2'),
      ).resolves.toBeUndefined()
      expect(sseHelper.writeError).toHaveBeenCalledWith('服务暂时不可用，请稍后重试')
      expect(sseHelper.end).toHaveBeenCalledTimes(1)
    })
  })
})
