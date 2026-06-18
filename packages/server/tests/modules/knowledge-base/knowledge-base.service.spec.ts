import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { KnowledgeBaseService } from '@/modules/knowledge-base/knowledge-base.service.js'

describe('KnowledgeBaseService', () => {
  let kbService: KnowledgeBaseService
  let mockPrisma: any
  let mockCleanup: any

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
      },
      document: {
        findMany: vi.fn(),
      },
    }
    mockCleanup = {
      cleanupKnowledgeBase: vi.fn().mockResolvedValue(undefined),
    }

    kbService = new KnowledgeBaseService(mockPrisma, mockCleanup)
  })

  describe('list', () => {
    it('AC-04a: returns knowledge bases for user sorted by pinned first', async () => {
      mockPrisma.knowledgeBase.findMany.mockResolvedValue([
        { id: 'kb1', name: 'Test KB', userId: 'u1' },
      ])

      const result = await kbService.list('u1')

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Test KB')
      expect(mockPrisma.knowledgeBase.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: [{ isPinned: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      })
    })
  })

  describe('create', () => {
    it('AC-04b: creates knowledge base with valid data', async () => {
      mockPrisma.knowledgeBase.create.mockResolvedValue({
        id: 'kb1',
        name: 'New KB',
        description: null,
        icon: null,
        userId: 'u1',
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
        id: 'kb1',
        name: 'Updated KB',
      })

      const result = await kbService.update('u1', 'kb1', { name: 'Updated KB' })

      expect(result.name).toBe('Updated KB')
    })

    it('AC-04d: throws NotFoundException when KB not found', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue(null)

      await expect(kbService.update('u1', 'kb1', { name: 'Updated' })).rejects.toThrow(
        NotFoundException,
      )
    })

    it('AC-04e: throws ForbiddenException when not owner', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u2' })

      await expect(kbService.update('u1', 'kb1', { name: 'Updated' })).rejects.toThrow(
        ForbiddenException,
      )
    })
  })

  describe('search', () => {
    it('returns matching folders and documents', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.folder.findMany.mockResolvedValue([{ id: 'f1', name: 'Notes' }])
      mockPrisma.document.findMany.mockResolvedValue([{ id: 'd1', name: 'notes.pdf' }])

      const result = await kbService.search('u1', 'kb1', 'notes')

      expect(result.folders).toHaveLength(1)
      expect(result.documents).toHaveLength(1)
      expect(mockPrisma.folder.findMany).toHaveBeenCalledWith({
        where: { kbId: 'kb1', name: { contains: 'notes', mode: 'insensitive' } },
        orderBy: { createdAt: 'asc' },
      })
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith({
        where: { kbId: 'kb1', name: { contains: 'notes', mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' },
      })
    })

    it('trims search query before searching', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.folder.findMany.mockResolvedValue([{ id: 'f1', name: 'Notes' }])
      mockPrisma.document.findMany.mockResolvedValue([])

      const result = await kbService.search('u1', 'kb1', '  notes  ')

      expect(result.folders).toHaveLength(1)
      expect(mockPrisma.folder.findMany).toHaveBeenCalledWith({
        where: { kbId: 'kb1', name: { contains: 'notes', mode: 'insensitive' } },
        orderBy: { createdAt: 'asc' },
      })
    })

    it('throws BadRequestException when query is empty', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })

      await expect(kbService.search('u1', 'kb1', '   ')).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when query exceeds max length', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })

      await expect(kbService.search('u1', 'kb1', 'a'.repeat(101))).rejects.toThrow(
        BadRequestException,
      )
    })

    it('throws ForbiddenException when not owner', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u2' })

      await expect(kbService.search('u1', 'kb1', 'notes')).rejects.toThrow(ForbiddenException)
    })
  })

  describe('remove', () => {
    it('AC-04f: removes knowledge base for owner and cleans up data', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.knowledgeBase.delete.mockResolvedValue({})

      const result = await kbService.remove('u1', 'kb1')

      expect(mockCleanup.cleanupKnowledgeBase).toHaveBeenCalledWith('kb1')
      expect(result.deleted).toBe(true)
    })
  })
})
