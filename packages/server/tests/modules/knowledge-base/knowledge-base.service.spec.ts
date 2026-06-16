import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KnowledgeBaseService } from '@/modules/knowledge-base/knowledge-base.service.js'
import { NotFoundException, ForbiddenException } from '@nestjs/common'

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
        orderBy: [
          { isPinned: 'desc' },
          { sortOrder: 'asc' },
          { createdAt: 'desc' },
        ],
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
    it('AC-04f: removes knowledge base for owner and cleans up data', async () => {
      mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ userId: 'u1' })
      mockPrisma.knowledgeBase.delete.mockResolvedValue({})

      const result = await kbService.remove('u1', 'kb1')

      expect(mockCleanup.cleanupKnowledgeBase).toHaveBeenCalledWith('kb1')
      expect(result.deleted).toBe(true)
    })
  })
})
