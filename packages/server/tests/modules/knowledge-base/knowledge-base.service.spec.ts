import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KnowledgeBaseService } from '@/modules/knowledge-base/knowledge-base.service.js'
import { NotFoundException, ForbiddenException } from '@nestjs/common'

describe('KnowledgeBaseService', () => {
  let kbService: KnowledgeBaseService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      knowledgeBase: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findUnique: vi.fn(),
      },
      folder: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findFirst: vi.fn(),
      },
    }

    kbService = new KnowledgeBaseService(mockPrisma)
  })

  describe('list', () => {
    it('AC-04a: returns knowledge bases for user', async () => {
      mockPrisma.knowledgeBase.findMany.mockResolvedValue([
        { id: 'kb1', name: 'Test KB', userId: 'u1' },
      ])

      const result = await kbService.list('u1')

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Test KB')
      expect(mockPrisma.knowledgeBase.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      })
    })
  })

  describe('create', () => {
    it('AC-04b: creates knowledge base with valid data', async () => {
      mockPrisma.knowledgeBase.create.mockResolvedValue({
        id: 'kb1', name: 'New KB', description: null, icon: null, userId: 'u1',
      })

      const result = await kbService.create('u1', { name: 'New KB' })

      expect(result.name).toBe('New KB')
      expect(mockPrisma.knowledgeBase.create).toHaveBeenCalledWith({
        data: { userId: 'u1', name: 'New KB', description: null, icon: null },
      })
    })
  })

  describe('update', () => {
    it('AC-04c: updates knowledge base for owner', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.knowledgeBase.update.mockResolvedValue({
        id: 'kb1', name: 'Updated KB',
      })

      const result = await kbService.update('u1', 'kb1', { name: 'Updated KB' })

      expect(result.name).toBe('Updated KB')
    })

    it('AC-04d: throws NotFoundException when KB not found', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue(null)

      await expect(kbService.update('u1', 'kb1', { name: 'Updated' }))
        .rejects.toThrow(NotFoundException)
    })

    it('AC-04e: throws ForbiddenException when not owner', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u2' })

      await expect(kbService.update('u1', 'kb1', { name: 'Updated' }))
        .rejects.toThrow(ForbiddenException)
    })
  })

  describe('remove', () => {
    it('AC-04f: removes knowledge base for owner', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.knowledgeBase.delete.mockResolvedValue({})

      const result = await kbService.remove('u1', 'kb1')

      expect(result.deleted).toBe(true)
    })
  })

  describe('folder operations', () => {
    it('AC-04g: lists folders in knowledge base', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.folder.findMany.mockResolvedValue([
        { id: 'f1', name: 'Folder 1' },
      ])

      const result = await kbService.listFolders('u1', 'kb1')

      expect(result).toHaveLength(1)
    })

    it('AC-04h: creates folder with valid parent', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.folder.findFirst.mockResolvedValue({ id: 'p1', kbId: 'kb1' })
      mockPrisma.folder.create.mockResolvedValue({ id: 'f1', name: 'New Folder' })

      const result = await kbService.createFolder('u1', 'kb1', { name: 'New Folder', parentId: 'p1' })

      expect(result.name).toBe('New Folder')
    })

    it('AC-04i: throws NotFoundException when parent folder not found', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.folder.findFirst.mockResolvedValue(null)

      await expect(kbService.createFolder('u1', 'kb1', { name: 'New', parentId: 'p1' }))
        .rejects.toThrow(NotFoundException)
    })
  })
})
