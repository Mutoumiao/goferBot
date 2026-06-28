import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DocumentService } from '@/modules/knowledge-base/document.service.js'

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
      folder: {
        findFirst: vi.fn(),
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
      isHealthy: vi.fn().mockResolvedValue(true),
    }
    mockCleanupService = {
      cleanupDocument: vi.fn().mockResolvedValue(undefined),
    }

    docService = new DocumentService(
      mockPrisma,
      mockStorage,
      mockCleanupService,
      mockQueueService,
    )
  })

  describe('list', () => {
    it('AC-04j: returns documents for KB owner with default sort', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.findMany.mockResolvedValue([{ id: 'd1', name: 'doc.txt', kbId: 'kb1' }])

      const result = await docService.list('u1', 'kb1')

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('doc.txt')
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith({
        where: { kbId: 'kb1', folderId: null },
        orderBy: { createdAt: 'desc' },
      })
    })

    it('treats empty string folderId as root (null)', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.findMany.mockResolvedValue([{ id: 'd1', name: 'root.txt' }])

      const result = await docService.list('u1', 'kb1', '')

      expect(result).toHaveLength(1)
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

    it('falls back to default sort when parameters are invalid', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.findMany.mockResolvedValue([{ id: 'd1', name: 'a' }])

      const result = await docService.list('u1', 'kb1', null, 'invalid', 'bad')

      expect(result).toHaveLength(1)
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith({
        where: { kbId: 'kb1', folderId: null },
        orderBy: { createdAt: 'desc' },
      })
    })
  })

  describe('upload', () => {
    it('AC-04k: uploads file and creates document for owner', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.create.mockResolvedValue({
        id: 'd1',
        name: 'test.txt',
        storageKey: 'kb1/1234567890-test.txt',
        size: BigInt(100),
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
      mockQueueService.isHealthy.mockResolvedValue(false)
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.create.mockResolvedValue({
        id: 'd1',
        name: 'test.txt',
        storageKey: 'kb1/1234567890-test.txt',
        size: BigInt(100),
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
    it('AC-04m: creates document with valid data and status uploaded', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.create.mockResolvedValue({
        id: 'd1',
        name: 'New Doc',
        kbId: 'kb1',
        folderId: null,
        status: 'uploaded',
      })

      const result = await docService.create('u1', 'kb1', { name: 'New Doc' })

      expect(result.name).toBe('New Doc')
      expect(mockPrisma.document.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: 'uploaded' }),
      })
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

      await expect(docService.update('u1', 'kb1', 'd1', { name: 'Updated' })).rejects.toThrow(
        NotFoundException,
      )
    })

    it('moves document to a folder within the same KB', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.findUnique.mockResolvedValue({ id: 'd1', kbId: 'kb1', folderId: null })
      mockPrisma.folder.findFirst.mockResolvedValue({ id: 'f1', kbId: 'kb1' })
      mockPrisma.document.update.mockResolvedValue({ id: 'd1', folderId: 'f1' })

      const result = await docService.update('u1', 'kb1', 'd1', { folderId: 'f1' })

      expect(result.folderId).toBe('f1')
      expect(mockPrisma.folder.findFirst).toHaveBeenCalledWith({
        where: { id: 'f1', kbId: 'kb1' },
      })
    })

    it('throws NotFoundException when target folder belongs to another KB', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.findUnique.mockResolvedValue({ id: 'd1', kbId: 'kb1', folderId: null })
      mockPrisma.folder.findFirst.mockResolvedValue(null)

      await expect(docService.update('u1', 'kb1', 'd1', { folderId: 'f2' })).rejects.toThrow(
        NotFoundException,
      )
    })

    it('allows moving document to root by setting folderId to null', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.findUnique.mockResolvedValue({ id: 'd1', kbId: 'kb1', folderId: 'f1' })
      mockPrisma.document.update.mockResolvedValue({ id: 'd1', folderId: null })

      const result = await docService.update('u1', 'kb1', 'd1', { folderId: null })

      expect(result.folderId).toBeNull()
      expect(mockPrisma.folder.findFirst).not.toHaveBeenCalled()
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

      await expect(docService.preview('u1', 'kb1', 'd1')).rejects.toThrow(NotFoundException)
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

      await expect(docService.remove('u1', 'kb1', 'd1')).rejects.toThrow(ForbiddenException)
    })

    it('invokes cleanup service before deleting document', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'd1',
        kbId: 'kb1',
        storageKey: 'kb1/d1.txt',
      })
      mockPrisma.document.delete.mockResolvedValue({})

      await docService.remove('u1', 'kb1', 'd1')

      expect(mockCleanupService.cleanupDocument).toHaveBeenCalledWith('d1', 'kb1/d1.txt')
      expect(mockPrisma.document.delete).toHaveBeenCalledWith({ where: { id: 'd1' } })
    })
  })
})
