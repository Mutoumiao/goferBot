import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FolderService } from '@/modules/knowledge-base/folder.service.js'
import { NotFoundException, ForbiddenException } from '@nestjs/common'

describe('FolderService', () => {
  let folderService: FolderService
  let mockPrisma: any
  let mockCleanup: any

  beforeEach(() => {
    mockPrisma = {
      knowledgeBase: {
        findUnique: vi.fn(),
      },
      folder: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
    }
    mockCleanup = {
      cleanupFolder: vi.fn().mockResolvedValue(undefined),
    }

    folderService = new FolderService(mockPrisma, mockCleanup)
  })

  describe('list', () => {
    it('lists folders under parent with default sort', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.folder.findMany.mockResolvedValue([{ id: 'f1', name: 'Folder' }])

      const result = await folderService.list('u1', 'kb1', 'p1')

      expect(result).toHaveLength(1)
      expect(mockPrisma.folder.findMany).toHaveBeenCalledWith({
        where: { kbId: 'kb1', parentId: 'p1' },
        orderBy: { createdAt: 'asc' },
      })
    })

    it('sorts folders by requested field and order', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.folder.findMany.mockResolvedValue([{ id: 'f1', name: 'A' }])

      const result = await folderService.list('u1', 'kb1', 'p1', 'name', 'desc')

      expect(result).toHaveLength(1)
      expect(mockPrisma.folder.findMany).toHaveBeenCalledWith({
        where: { kbId: 'kb1', parentId: 'p1' },
        orderBy: { name: 'desc' },
      })
    })
  })

  describe('create', () => {
    it('creates folder with valid parent', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.folder.findFirst.mockResolvedValue({ id: 'p1', kbId: 'kb1' })
      mockPrisma.folder.create.mockResolvedValue({ id: 'f1', name: 'New Folder' })

      const result = await folderService.create('u1', 'kb1', { name: 'New Folder', parentId: 'p1' })

      expect(result.name).toBe('New Folder')
    })

    it('throws NotFoundException when parent folder not found', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.folder.findFirst.mockResolvedValue(null)

      await expect(folderService.create('u1', 'kb1', { name: 'New', parentId: 'p1' }))
        .rejects.toThrow(NotFoundException)
    })
  })

  describe('update', () => {
    it('renames folder', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.folder.findFirst.mockResolvedValue({ id: 'f1', kbId: 'kb1' })
      mockPrisma.folder.update.mockResolvedValue({ id: 'f1', name: 'Renamed' })

      const result = await folderService.update('u1', 'kb1', 'f1', { name: 'Renamed' })

      expect(result.name).toBe('Renamed')
    })
  })

  describe('remove', () => {
    it('removes folder and cleans up', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.folder.findFirst.mockResolvedValue({ id: 'f1', kbId: 'kb1' })
      mockPrisma.folder.delete.mockResolvedValue({})

      const result = await folderService.remove('u1', 'kb1', 'f1')

      expect(mockCleanup.cleanupFolder).toHaveBeenCalledWith('kb1', 'f1')
      expect(result.deleted).toBe(true)
    })
  })

  describe('getBreadcrumbs', () => {
    it('returns empty array for root folder', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })

      const result = await folderService.getBreadcrumbs('u1', 'kb1')

      expect(result).toHaveLength(0)
    })

    it('returns ancestors when folderId provided', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.folder.findFirst.mockResolvedValueOnce({ id: 'c1', kbId: 'kb1', parentId: 'p1' })
      mockPrisma.folder.findUnique
        .mockResolvedValueOnce({ id: 'c1', name: 'Child', parentId: 'p1' })
        .mockResolvedValueOnce({ id: 'p1', name: 'Parent', parentId: null })

      const result = await folderService.getBreadcrumbs('u1', 'kb1', 'c1')

      expect(result).toHaveLength(2)
      expect(result.map((f) => f.name)).toEqual(['Parent', 'Child'])
    })

    it('throws NotFoundException when folder not in KB', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.folder.findFirst.mockResolvedValue(null)

      await expect(folderService.getBreadcrumbs('u1', 'kb1', 'c1'))
        .rejects.toThrow(NotFoundException)
    })

    it('throws ForbiddenException when not owner', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u2' })

      await expect(folderService.getBreadcrumbs('u1', 'kb1', 'c1'))
        .rejects.toThrow(ForbiddenException)
    })
  })

  describe('findAncestors', () => {
    it('returns ancestor chain', async () => {
      mockPrisma.folder.findUnique
        .mockResolvedValueOnce({ id: 'c1', name: 'Child', parentId: 'p1' })
        .mockResolvedValueOnce({ id: 'p1', name: 'Parent', parentId: null })

      const result = await folderService.findAncestors('c1')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('p1')
      expect(result[1].id).toBe('c1')
    })
  })

  describe('isDescendant', () => {
    it('returns true for descendant', async () => {
      mockPrisma.folder.findUnique
        .mockResolvedValueOnce({ id: 'c1', parentId: 'p1' })
        .mockResolvedValueOnce({ id: 'p1', parentId: null })

      const result = await folderService.isDescendant('p1', 'c1')

      expect(result).toBe(true)
    })

    it('returns false for unrelated folder', async () => {
      mockPrisma.folder.findUnique.mockResolvedValue({ id: 'c1', parentId: null })

      const result = await folderService.isDescendant('p1', 'c1')

      expect(result).toBe(false)
    })
  })
})
