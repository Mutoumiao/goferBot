import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { Session } from '@goferbot/data'

const mockPagination = {
  total: 10,
  size: 10,
  currentPage: 1,
  totalPage: 1,
  hasNextPage: false,
  hasPrevPage: false,
}

describe('useChatHistory', () => {
  const mockUseRequest = vi.fn()
  const mockGetSessions = vi.fn((page: number, limit: number) => ({ page, limit }))

  beforeEach(() => {
    vi.clearAllMocks()
    
    vi.doMock('alova/client', () => ({
      useRequest: mockUseRequest,
    }))
    
    vi.doMock('@/api/chat', () => ({
      getSessions: mockGetSessions,
    }))
  })

  it('initializes with loading state', async () => {
    mockUseRequest.mockReturnValue({
      data: undefined,
      loading: true,
      error: undefined,
      send: vi.fn(),
    })

    const { useChatHistory } = await import('@/features/chat/hooks')
    const { result } = renderHook(() => useChatHistory(1, 10))

    expect(result.current.loading).toBe(true)
    expect(result.current.sessions).toEqual([])
    expect(result.current.pagination).toBeNull()
    expect(result.current.error).toBeUndefined()
    
    expect(mockUseRequest).toHaveBeenCalled()
    const requestFn = mockUseRequest.mock.calls[0][0]
    requestFn()
    expect(mockGetSessions).toHaveBeenCalledWith(1, 10)
  })

  it('returns sessions and pagination when data is fetched', async () => {
    const mockSessions: Session[] = [
      { id: 's1', title: 'Test Session', createdAt: '2024-01-01', updatedAt: '2024-01-01', messageCount: 5 },
      { id: 's2', title: 'Another Session', createdAt: '2024-01-02', updatedAt: '2024-01-02', messageCount: 3 },
    ]
    mockUseRequest.mockReturnValue({
      data: { items: mockSessions, pagination: mockPagination },
      loading: false,
      error: undefined,
      send: vi.fn(),
    })

    const { useChatHistory } = await import('@/features/chat/hooks')
    const { result } = renderHook(() => useChatHistory(1, 10))

    expect(result.current.loading).toBe(false)
    expect(result.current.sessions).toEqual(mockSessions)
    expect(result.current.pagination).toEqual(mockPagination)
    expect(result.current.error).toBeUndefined()
  })

  it('handles empty sessions array', async () => {
    mockUseRequest.mockReturnValue({
      data: { items: [], pagination: { ...mockPagination, total: 0 } },
      loading: false,
      error: undefined,
      send: vi.fn(),
    })

    const { useChatHistory } = await import('@/features/chat/hooks')
    const { result } = renderHook(() => useChatHistory(1, 10))

    expect(result.current.sessions).toEqual([])
    expect(result.current.pagination?.total).toBe(0)
  })

  it('handles error state', async () => {
    const mockError = new Error('Network error')
    mockUseRequest.mockReturnValue({
      data: undefined,
      loading: false,
      error: mockError,
      send: vi.fn(),
    })

    const { useChatHistory } = await import('@/features/chat/hooks')
    const { result } = renderHook(() => useChatHistory(1, 10))

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(mockError)
    expect(result.current.sessions).toEqual([])
    expect(result.current.pagination).toBeNull()
  })

  it('calls reload to refetch data', async () => {
    const mockSend = vi.fn().mockResolvedValue({ items: [], pagination: mockPagination })
    mockUseRequest.mockReturnValue({
      data: { items: [], pagination: mockPagination },
      loading: false,
      error: undefined,
      send: mockSend,
    })

    const { useChatHistory } = await import('@/features/chat/hooks')
    const { result } = renderHook(() => useChatHistory(1, 10))

    await act(async () => {
      await result.current.reload()
    })

    expect(mockSend).toHaveBeenCalled()
  })

  it('passes correct page and pageSize to getSessions', async () => {
    mockUseRequest.mockReturnValue({
      data: { items: [], pagination: mockPagination },
      loading: false,
      error: undefined,
      send: vi.fn(),
    })

    const { useChatHistory } = await import('@/features/chat/hooks')
    renderHook(() => useChatHistory(2, 20))

    expect(mockUseRequest).toHaveBeenCalled()
    const requestFn = mockUseRequest.mock.calls[0][0]
    requestFn()
    expect(mockGetSessions).toHaveBeenCalledWith(2, 20)
  })
})