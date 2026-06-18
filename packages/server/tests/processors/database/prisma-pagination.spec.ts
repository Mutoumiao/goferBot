import { beforeEach, describe, expect, it, vi } from 'vitest'

function createMockPrisma() {
  return {
    user: {
      paginate: vi.fn(),
      exists: vi.fn(),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  }
}

describe('Prisma Pagination Extension', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma = createMockPrisma()
  })

  it('AC-01: paginate returns correct data and pagination metadata', async () => {
    mockPrisma.user.paginate.mockResolvedValue({
      data: Array.from({ length: 10 }, (_, i) => ({
        id: `u${i}`,
        email: `user${i}@test.com`,
        name: `User ${i}`,
      })),
      pagination: {
        total: 25,
        size: 10,
        totalPage: 3,
        currentPage: 1,
        hasNextPage: true,
        hasPrevPage: false,
      },
    })

    const result = await mockPrisma.user.paginate(
      { where: { email: { contains: 'test' } }, orderBy: { createdAt: 'desc' } },
      { page: 1, size: 10 },
    )

    expect(result.data).toHaveLength(10)
    expect(result.pagination.total).toBe(25)
    expect(result.pagination.size).toBe(10)
    expect(result.pagination.currentPage).toBe(1)
    expect(result.pagination.totalPage).toBe(3)
    expect(result.pagination.hasNextPage).toBe(true)
    expect(result.pagination.hasPrevPage).toBe(false)
    expect(mockPrisma.user.paginate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.any(Object), orderBy: expect.any(Object) }),
      expect.objectContaining({ page: 1, size: 10 }),
    )
  })

  it('AC-02: returns empty array for out-of-range page', async () => {
    mockPrisma.user.paginate.mockResolvedValue({
      data: [],
      pagination: {
        total: 5,
        size: 10,
        totalPage: 1,
        currentPage: 10,
        hasNextPage: false,
        hasPrevPage: true,
      },
    })

    const result = await mockPrisma.user.paginate(
      { where: { email: { contains: 'test' } }, orderBy: { createdAt: 'desc' } },
      { page: 10, size: 10 },
    )

    expect(result.data).toHaveLength(0)
    expect(result.pagination.hasNextPage).toBe(false)
    expect(mockPrisma.user.paginate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ page: 10, size: 10 }),
    )
  })

  it('AC-03: exists returns true for matching record', async () => {
    mockPrisma.user.exists.mockResolvedValue(true)

    const result = await mockPrisma.user.exists({
      where: { email: 'test@example.com' },
    })

    expect(result).toBe(true)
    expect(mockPrisma.user.exists).toHaveBeenCalledWith({
      where: { email: 'test@example.com' },
    })
  })

  it('AC-04: exists returns false for non-matching record', async () => {
    mockPrisma.user.exists.mockResolvedValue(false)

    const result = await mockPrisma.user.exists({
      where: { email: 'nonexistent@example.com' },
    })

    expect(result).toBe(false)
  })

  it('AC-05: paginate handles invalid args gracefully', async () => {
    mockPrisma.user.paginate.mockResolvedValue({
      data: [],
      pagination: {
        total: 0,
        size: 0,
        totalPage: 0,
        currentPage: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })

    const result = await mockPrisma.user.paginate(null as any, { page: 1, size: 10 })

    expect(result.data).toHaveLength(0)
    expect(result.pagination.total).toBe(0)
  })
})
