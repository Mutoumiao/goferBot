import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionService } from '@/modules/session/session.service.js'

function createMockPrisma(overrides = {}) {
  return {
    session: {
      paginate: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      ...((overrides as any).session || {}),
    },
    ...overrides,
  }
}

describe('SessionService', () => {
  let service: SessionService
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma = createMockPrisma()
    service = new SessionService(mockPrisma as any)
  })

  it('AC-01: list returns paginated result with default limit 50', async () => {
    const userId = 'user-123'
    mockPrisma.session.paginate.mockResolvedValue({
      data: Array.from({ length: 50 }, (_, i) => ({
        id: `s${i}`,
        userId,
        title: `Session ${i}`,
        provider: null,
        model: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        _count: { messages: i },
      })),
      pagination: {
        total: 60,
        size: 50,
        totalPage: 2,
        currentPage: 1,
        hasNextPage: true,
        hasPrevPage: false,
      },
    })

    const result = await service.list(userId, { page: 1, limit: 50 })

    expect(result.items).toHaveLength(50)
    expect(result.pagination.total).toBe(60)
    expect(result.pagination.size).toBe(50)
    expect(result.pagination.hasNextPage).toBe(true)
    expect(result.items[0].messageCount).toBe(0)
    expect(result.items[49].messageCount).toBe(49)
    expect(mockPrisma.session.paginate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { messages: true } } },
      }),
      expect.objectContaining({ page: 1, size: 50 }),
    )
  })

  it('AC-02: returns second page correctly', async () => {
    const userId = 'user-123'
    mockPrisma.session.paginate.mockResolvedValue({
      data: Array.from({ length: 10 }, (_, i) => ({
        id: `s${i + 50}`,
        userId,
        title: `Session ${i + 50}`,
        provider: null,
        model: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        _count: { messages: 0 },
      })),
      pagination: {
        total: 60,
        size: 50,
        totalPage: 2,
        currentPage: 2,
        hasNextPage: false,
        hasPrevPage: true,
      },
    })

    const result = await service.list(userId, { page: 2, limit: 50 })

    expect(result.items).toHaveLength(10)
    expect(result.pagination.currentPage).toBe(2)
    expect(result.pagination.hasPrevPage).toBe(true)
    expect(result.pagination.hasNextPage).toBe(false)
  })

  it('AC-03: returns empty array when no sessions', async () => {
    const userId = 'user-empty'
    mockPrisma.session.paginate.mockResolvedValue({
      data: [],
      pagination: {
        total: 0,
        size: 50,
        totalPage: 0,
        currentPage: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })

    const result = await service.list(userId, { page: 1, limit: 50 })

    expect(result.items).toHaveLength(0)
    expect(result.pagination.total).toBe(0)
  })

  it('AC-04: maps _count.messages to messageCount', async () => {
    const userId = 'user-123'
    mockPrisma.session.paginate.mockResolvedValue({
      data: [
        {
          id: 's1',
          userId,
          title: 'Test Session',
          provider: 'openai',
          model: 'gpt-4',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          _count: { messages: 42 },
        },
      ],
      pagination: {
        total: 1,
        size: 50,
        totalPage: 1,
        currentPage: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })

    const result = await service.list(userId)

    expect(result.items[0].messageCount).toBe(42)
    expect(result.items[0].title).toBe('Test Session')
    expect(result.items[0].provider).toBe('openai')
  })
})
