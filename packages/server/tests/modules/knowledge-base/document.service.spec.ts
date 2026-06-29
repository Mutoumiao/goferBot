import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DocumentService } from '@/modules/knowledge-base/document.service.js'

describe('DocumentService', () => {
  let docService: DocumentService
  let mockDocumentRepository: any
  let mockFolderRepository: any
  let mockKbRepository: any
  let mockUploadService: any
  let mockMoveService: any
  let mockPreviewService: any
  let mockQueueService: any

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
    mockUploadService = {
      upload: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      enqueueReindex: vi.fn(),
    }
    mockMoveService = {
      move: vi.fn(),
      copy: vi.fn(),
      remove: vi.fn(),
    }
    mockPreviewService = {
      preview: vi.fn(),
    }
    mockQueueService = {
      isHealthy: vi.fn().mockResolvedValue(true),
    }

    docService = new DocumentService(
      mockDocumentRepository,
      mockFolderRepository,
      mockKbRepository,
      mockUploadService,
      mockMoveService,
      mockPreviewService,
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
    })

    it('treats empty string folderId as root (null)', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.findManyByKbIdWithPagination.mockResolvedValue([
        { id: 'd1', name: 'root.txt' },
      ])
      mockDocumentRepository.countByKbId.mockResolvedValue(1)

      const result = await docService.list('u1', 'kb1', '')

      expect(result.items).toHaveLength(1)
      expect(mockDocumentRepository.findManyByKbIdWithPagination).toHaveBeenCalled()
    })

    it('sorts documents by requested field', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.findManyByKbIdWithPagination.mockResolvedValue([
        { id: 'd1', name: 'a' },
      ])
      mockDocumentRepository.countByKbId.mockResolvedValue(1)

      const result = await docService.list('u1', 'kb1', null, 'name', 'asc')

      expect(result.items).toHaveLength(1)
    })

    it('sorts documents by type using ext and mimeType', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.findManyByKbIdWithPagination.mockResolvedValue([
        { id: 'd1', name: 'a' },
      ])
      mockDocumentRepository.countByKbId.mockResolvedValue(1)

      const result = await docService.list('u1', 'kb1', null, 'type', 'desc')

      expect(result.items).toHaveLength(1)
    })

    it('falls back to default sort when parameters are invalid', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.findManyByKbIdWithPagination.mockResolvedValue([
        { id: 'd1', name: 'a' },
      ])
      mockDocumentRepository.countByKbId.mockResolvedValue(1)

      const result = await docService.list('u1', 'kb1', null, 'invalid', 'bad')

      expect(result.items).toHaveLength(1)
    })
  })

  describe('upload', () => {
    it('AC-04k: uploads file via uploadService', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockUploadService.upload.mockResolvedValue({
        id: 'd1',
        name: 'test.txt',
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
      expect(mockUploadService.upload).toHaveBeenCalled()
    })
  })

  describe('create', () => {
    it('AC-04m: creates document via uploadService', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockUploadService.create.mockResolvedValue({
        id: 'd1',
        name: 'New Doc',
        kbId: 'kb1',
        folderId: null,
        status: 'uploaded',
      })

      const result = await docService.create('u1', 'kb1', { name: 'New Doc' })

      expect(result.name).toBe('New Doc')
      expect(mockUploadService.create).toHaveBeenCalled()
    })
  })

  describe('update', () => {
    it('AC-04n: updates document for owner', async () => {
      mockKbRepository.findById.mockResolvedValue({ userId: 'u1' })
      mockDocumentRepository.findById.mockResolvedValue({ id: 'd1', kbId: 'kb1' })
      mockUploadService.update.mockResolvedValue({ id: 'd1', name: 'Updated Doc' })

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
      mockUploadService.update.mockResolvedValue({ id: 'd1', folderId: 'f1' })

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
      mockUploadService.update.mockResolvedValue({ id: 'd1', folderId: null })

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
      mockPreviewService.preview.mockResolvedValue({ type: 'text', content: '# Hello' })

      const result = await docService.preview('u1', 'kb1', 'd1')

      expect(result.type).toBe('text')
      expect(result.content).toBe('# Hello')
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
      mockPreviewService.preview.mockResolvedValue({
        type: 'pdf',
        url: 'http://minio/test-bucket/kb1/doc.pdf',
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
    it('AC-04p: delegates to moveService.remove', async () => {
      mockMoveService.remove.mockResolvedValue({ deleted: true })

      const result = await docService.remove('u1', 'kb1', 'd1')

      expect(result.deleted).toBe(true)
      expect(mockMoveService.remove).toHaveBeenCalledWith('u1', 'kb1', 'd1')
    })
  })
})
