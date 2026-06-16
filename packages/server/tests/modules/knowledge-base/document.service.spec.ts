import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DocumentService } from '@/modules/knowledge-base/document.service.js'
import { NotFoundException, ForbiddenException } from '@nestjs/common'

describe('DocumentService', () => {
  let docService: DocumentService
  let mockPrisma: any
  let mockStorage: any
  let mockVectorService: any
  let mockQueueService: any

  let mockCleanupService: any

  beforeEach(() => {
    mockPrisma = {
      knowledgeBase: {
        findUnique: vi.fn(),
      },
      document: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    }
    mockStorage = {
      uploadFile: vi.fn().mockResolvedValue(undefined),
      downloadFile: vi.fn().mockResolvedValue(Buffer.from('# Hello')),
      getUrl: vi.fn().mockReturnValue('http://minio/test-bucket/kb1/doc.pdf'),
    }
    mockVectorService = {}
    mockQueueService = {
      addDocumentJob: vi.fn().mockResolvedValue(undefined),
      isHealthy: vi.fn().mockReturnValue(true),
    }
    mockCleanupService = {
      cleanupDocument: vi.fn().mockResolvedValue(undefined),
    }

    docService = new DocumentService(mockPrisma, mockStorage, mockVectorService, mockCleanupService, mockQueueService)
  })

  describe('list', () => {
    it('AC-04j: returns documents for KB owner with default sort', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.findMany.mockResolvedValue([
        { id: 'd1', name: 'doc.txt', kbId: 'kb1' },
      ])

      const result = await docService.list('u1', 'kb1')

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('doc.txt')
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith({
        where: { kbId: 'kb1', folderId: null },
        orderBy: { createdAt: 'desc' },
      })
    })

    it('sorts documents by requested field', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.findMany.mockResolvedValue([{ id: 'd1', name: 'a' }])

      const result = await docService.list('u1', 'kb1', null, 'name', 'asc')

      expect(result).toHaveLength(1)
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith({
        where: { kbId: 'kb1', folderId: null },
        orderBy: { name: 'asc' },
      })
    })

    it('sorts documents by type using ext and mimeType', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.findMany.mockResolvedValue([{ id: 'd1', name: 'a' }])

      const result = await docService.list('u1', 'kb1', null, 'type', 'desc')

      expect(result).toHaveLength(1)
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith({
        where: { kbId: 'kb1', folderId: null },
        orderBy: [{ ext: 'desc' }, { mimeType: 'desc' }],
      })
    })
  })

  describe('upload', () => {
    it('AC-04k: uploads file and creates document for owner', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.create.mockResolvedValue({
        id: 'd1', name: 'test.txt', storageKey: 'kb1/1234567890-test.txt', size: BigInt(100),
      })

      const result = await docService.upload('u1', 'kb1', {
        filename: 'test.txt',
        ext: 'txt',
        mimeType: 'text/plain',
        size: 100,
        buffer: Buffer.from('hello'),
        folderId: null,
      })

      expect(result.name).toBe('test.txt')
      expect(mockStorage.uploadFile).toHaveBeenCalled()
      expect(mockQueueService.addDocumentJob).toHaveBeenCalledWith('d1', 'index')
    })

    it('AC-04l: uploads file without queue when queueService not healthy', async () => {
      mockQueueService.isHealthy.mockReturnValue(false)
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.create.mockResolvedValue({
        id: 'd1', name: 'test.txt', storageKey: 'kb1/1234567890-test.txt', size: BigInt(100),
      })

      const result = await docService.upload('u1', 'kb1', {
        filename: 'test.txt',
        ext: 'txt',
        mimeType: 'text/plain',
        size: 100,
        buffer: Buffer.from('hello'),
        folderId: null,
      })

      expect(result.name).toBe('test.txt')
      expect(mockStorage.uploadFile).toHaveBeenCalled()
      expect(mockQueueService.addDocumentJob).not.toHaveBeenCalled()
    })
  })

  describe('create', () => {
    it('AC-04m: creates document with valid data', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.create.mockResolvedValue({
        id: 'd1', name: 'New Doc', kbId: 'kb1', folderId: null,
      })

      const result = await docService.create('u1', 'kb1', { name: 'New Doc' })

      expect(result.name).toBe('New Doc')
    })
  })

  describe('update', () => {
    it('AC-04n: updates document for owner', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.findUnique.mockResolvedValue({ id: 'd1', kbId: 'kb1' })
      mockPrisma.document.update.mockResolvedValue({ id: 'd1', name: 'Updated Doc' })

      const result = await docService.update('u1', 'kb1', 'd1', { name: 'Updated Doc' })

      expect(result.name).toBe('Updated Doc')
    })

    it('AC-04o: throws NotFoundException when document not in KB', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.findUnique.mockResolvedValue({ id: 'd1', kbId: 'kb2' })

      await expect(docService.update('u1', 'kb1', 'd1', { name: 'Updated' }))
        .rejects.toThrow(NotFoundException)
    })
  })

  describe('preview', () => {
    it('returns text content for markdown file', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'd1',
        kbId: 'kb1',
        ext: 'md',
        mimeType: 'text/markdown',
        storageKey: 'kb1/1234567890-readme.md',
      })

      const result = await docService.preview('u1', 'kb1', 'd1')

      expect(result.type).toBe('text')
      expect(result.content).toBe('# Hello')
      expect(mockStorage.downloadFile).toHaveBeenCalledWith('kb1/1234567890-readme.md')
    })

    it('returns pdf url for pdf file', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'd1',
        kbId: 'kb1',
        ext: 'pdf',
        mimeType: 'application/pdf',
        storageKey: 'kb1/1234567890-doc.pdf',
      })

      const result = await docService.preview('u1', 'kb1', 'd1')

      expect(result.type).toBe('pdf')
      expect(result.url).toBe('http://minio/test-bucket/kb1/doc.pdf')
    })

    it('throws NotFoundException when document not in KB', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.findUnique.mockResolvedValue({ id: 'd1', kbId: 'kb2' })

      await expect(docService.preview('u1', 'kb1', 'd1'))
        .rejects.toThrow(NotFoundException)
    })
  })

  describe('remove', () => {
    it('AC-04p: removes document for owner', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.findUnique.mockResolvedValue({ id: 'd1', kbId: 'kb1' })
      mockPrisma.document.delete.mockResolvedValue({})

      const result = await docService.remove('u1', 'kb1', 'd1')

      expect(result.deleted).toBe(true)
    })

    it('AC-04q: throws ForbiddenException when not owner', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u2' })

      await expect(docService.remove('u1', 'kb1', 'd1'))
        .rejects.toThrow(ForbiddenException)
    })
  })
})
