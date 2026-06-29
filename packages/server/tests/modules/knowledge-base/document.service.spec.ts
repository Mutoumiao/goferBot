import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DocumentService } from '@/modules/knowledge-base/document.service.js'

describe('DocumentService', () => {
  let docService: DocumentService
  let mockDocumentRepository: any
  let mockFolderRepository: any
  let mockKbRepository: any
  let mockStorage: any
  let mockQueueService: any
  let mockCleanupService: any
  let mockEventEmitter: any

  beforeEach(() => {
    mockDocumentRepository = {
      findManyByKbIdWithPagination: vi.fn(),
      countByKbId: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteChunksByDocumentId: vi.fn().mockResolvedValue({ count: 0 }),
    }
    mockFolderRepository = {
      findByIdAndKb: vi.fn(),
    }
    mockKbRepository = {
      findById: vi.fn(),
    }
    mockStorage = {
      uploadFile: vi.fn().mockResolvedValue(undefined),
      downloadFile: vi.fn().mockResolvedValue(Buffer.from('# Hello')),
      getUrl: vi.fn().mockReturnValue('http://minio/test-bucket/kb1/doc.pdf'),
    }
    mockQueueService = {
      addDocumentJob: vi.fn().mockResolvedValue(undefined),
      isHealthy: vi.fn().mockResolvedValue(true),
    }
    mockCleanupService = {
      cleanupDocument: vi.fn().mockResolvedValue(undefined),
    }

    mockEventEmitter = {
      emitAsync: vi.fn().mockResolvedValue(undefined),
    }

    docService = new DocumentService(
      mockDocumentRepository,
      mockFolderRepository,
      mockKbRepository,
      mockStorage,
      mockCleanupService,
      mockEventEmitter as any,
      mockQueueService,
    )
  })

  describe('list', () => {
    it('AC-04j: returns documents for KB owner with default sort', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.findManyByKbIdWithPagination.mockResolvedValue([
        { id: 'd1', name: 'doc.txt', kbId: 'kb1' },
      ])
      mockDocumentRepository.countByKbId.mockResolvedValue(1)

      const result = await docService.list('u1', 'kb1')

      expect(result.items).toHaveLength(1)
      expect(result.items[0].name).toBe('doc.txt')
      expect(result.total).toBe(1)
      expect(mockDocumentRepository.findManyByKbIdWithPagination).toHaveBeenCalledWith(
        'kb1',
        null,
        { createdAt: 'desc' },
        0,
        20,
      )
    })

    it('treats empty string folderId as root (null)', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.findManyByKbIdWithPagination.mockResolvedValue([
        { id: 'd1', name: 'root.txt' },
      ])
      mockDocumentRepository.countByKbId.mockResolvedValue(1)

      const result = await docService.list('u1', 'kb1', '')

      expect(result.items).toHaveLength(1)
      expect(mockDocumentRepository.findManyByKbIdWithPagination).toHaveBeenCalledWith(
        'kb1',
        null,
        { createdAt: 'desc' },
        0,
        20,
      )
    })

    it('sorts documents by requested field', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.findManyByKbIdWithPagination.mockResolvedValue([
        { id: 'd1', name: 'a' },
      ])
      mockDocumentRepository.countByKbId.mockResolvedValue(1)

      const result = await docService.list('u1', 'kb1', null, 'name', 'asc')

      expect(result.items).toHaveLength(1)
      expect(mockDocumentRepository.findManyByKbIdWithPagination).toHaveBeenCalledWith(
        'kb1',
        null,
        { name: 'asc' },
        0,
        20,
      )
    })

    it('sorts documents by type using ext and mimeType', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.findManyByKbIdWithPagination.mockResolvedValue([
        { id: 'd1', name: 'a' },
      ])
      mockDocumentRepository.countByKbId.mockResolvedValue(1)

      const result = await docService.list('u1', 'kb1', null, 'type', 'desc')

      expect(result.items).toHaveLength(1)
      expect(mockDocumentRepository.findManyByKbIdWithPagination).toHaveBeenCalledWith(
        'kb1',
        null,
        [{ ext: 'desc' }, { mimeType: 'desc' }],
        0,
        20,
      )
    })

    it('falls back to default sort when parameters are invalid', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.findManyByKbIdWithPagination.mockResolvedValue([
        { id: 'd1', name: 'a' },
      ])
      mockDocumentRepository.countByKbId.mockResolvedValue(1)

      const result = await docService.list('u1', 'kb1', null, 'invalid', 'bad')

      expect(result.items).toHaveLength(1)
      expect(mockDocumentRepository.findManyByKbIdWithPagination).toHaveBeenCalledWith(
        'kb1',
        null,
        { createdAt: 'desc' },
        0,
        20,
      )
    })
  })

  describe('upload', () => {
    it('AC-04k: uploads file and creates document for owner', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.create.mockResolvedValue({
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
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        'document.uploaded',
        expect.anything(),
      )
    })

    it('AC-04l: uploads file without event when queueService not healthy', async () => {
      mockQueueService.isHealthy.mockResolvedValue(false)
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.create.mockResolvedValue({
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
      expect(mockEventEmitter.emitAsync).not.toHaveBeenCalled()
    })
  })

  describe('create', () => {
    it('AC-04m: creates document with valid data and status uploaded', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.create.mockResolvedValue({
        id: 'd1',
        name: 'New Doc',
        kbId: 'kb1',
        folderId: null,
        status: 'uploaded',
      })

      const result = await docService.create('u1', 'kb1', { name: 'New Doc' })

      expect(result.name).toBe('New Doc')
      expect(mockDocumentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'uploaded' }),
      )
    })
  })

  describe('update', () => {
    it('AC-04n: updates document for owner', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.findById.mockResolvedValue({ id: 'd1', kbId: 'kb1' })
      mockDocumentRepository.update.mockResolvedValue({ id: 'd1', name: 'Updated Doc' })

      const result = await docService.update('u1', 'kb1', 'd1', { name: 'Updated Doc' })

      expect(result.name).toBe('Updated Doc')
    })

    it('AC-04o: throws NotFoundException when document not in KB', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.findById.mockResolvedValue({ id: 'd1', kbId: 'kb2' })

      await expect(docService.update('u1', 'kb1', 'd1', { name: 'Updated' })).rejects.toThrow(
        NotFoundException,
      )
    })

    it('moves document to a folder within the same KB', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.findById.mockResolvedValue({ id: 'd1', kbId: 'kb1', folderId: null })
      mockFolderRepository.findByIdAndKb.mockResolvedValue({ id: 'f1', kbId: 'kb1' })
      mockDocumentRepository.update.mockResolvedValue({ id: 'd1', folderId: 'f1' })

      const result = await docService.update('u1', 'kb1', 'd1', { folderId: 'f1' })

      expect(result.folderId).toBe('f1')
      expect(mockFolderRepository.findByIdAndKb).toHaveBeenCalledWith('f1', 'kb1')
    })

    it('throws NotFoundException when target folder belongs to another KB', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.findById.mockResolvedValue({ id: 'd1', kbId: 'kb1', folderId: null })
      mockFolderRepository.findByIdAndKb.mockResolvedValue(null)

      await expect(docService.update('u1', 'kb1', 'd1', { folderId: 'f2' })).rejects.toThrow(
        NotFoundException,
      )
    })

    it('allows moving document to root by setting folderId to null', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.findById.mockResolvedValue({ id: 'd1', kbId: 'kb1', folderId: 'f1' })
      mockDocumentRepository.update.mockResolvedValue({ id: 'd1', folderId: null })

      const result = await docService.update('u1', 'kb1', 'd1', { folderId: null })

      expect(result.folderId).toBeNull()
      expect(mockFolderRepository.findByIdAndKb).not.toHaveBeenCalled()
    })
  })

  describe('preview', () => {
    it('returns text content for markdown file', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.findById.mockResolvedValue({
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
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.findById.mockResolvedValue({
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
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.findById.mockResolvedValue({ id: 'd1', kbId: 'kb2' })

      await expect(docService.preview('u1', 'kb1', 'd1')).rejects.toThrow(NotFoundException)
    })
  })

  describe('remove', () => {
    it('AC-04p: removes document for owner', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.findById.mockResolvedValue({ id: 'd1', kbId: 'kb1' })
      mockDocumentRepository.delete.mockResolvedValue({})

      const result = await docService.remove('u1', 'kb1', 'd1')

      expect(result.deleted).toBe(true)
    })

    it('AC-04q: throws ForbiddenException when not owner', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u2' })

      await expect(docService.remove('u1', 'kb1', 'd1')).rejects.toThrow(ForbiddenException)
    })

    it('invokes cleanup service before deleting document', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.findById.mockResolvedValue({
        id: 'd1',
        kbId: 'kb1',
        storageKey: 'kb1/d1.txt',
      })
      mockDocumentRepository.delete.mockResolvedValue({})

      await docService.remove('u1', 'kb1', 'd1')

      expect(mockCleanupService.cleanupDocument).toHaveBeenCalledWith('d1', 'kb1/d1.txt')
      expect(mockDocumentRepository.delete).toHaveBeenCalledWith('d1')
    })
  })
})
