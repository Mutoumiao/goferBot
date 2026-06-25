import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useQueryWithRetry } from '@/hooks/useQueryWithRetry'

describe('useQueryWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs fetcher immediately when immediate=true', async () => {
    const fetcher = vi.fn().mockResolvedValue('ok')
    const { result } = renderHook(() => useQueryWithRetry(fetcher, [], true))
    await waitFor(() => {
      expect(result.current.data).toBe('ok')
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('captures error through mapErrorMessage', async () => {
    const fetcher = vi.fn().mockRejectedValue({ status: 500 })
    const { result } = renderHook(() => useQueryWithRetry(fetcher, [], true))
    await waitFor(() => {
      expect(result.current.error).toMatch(/系统繁忙/)
    })
    expect(result.current.loading).toBe(false)
  })

  it('runs on deps change', async () => {
    const fetcher = vi.fn().mockResolvedValue('v1')
    const { result, rerender } = renderHook(({ deps }) => useQueryWithRetry(fetcher, deps, true), {
      initialProps: { deps: [1] as unknown[] },
    })
    await waitFor(() => {
      expect(result.current.data).toBe('v1')
    })
    fetcher.mockResolvedValueOnce('v2')
    rerender({ deps: [2] })
    await waitFor(() => {
      expect(result.current.data).toBe('v2')
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('run() can be triggered manually', async () => {
    const fetcher = vi.fn().mockResolvedValue('manual')
    const { result } = renderHook(() => useQueryWithRetry(fetcher, [], false))
    expect(fetcher).not.toHaveBeenCalled()
    act(() => {
      void result.current.run()
    })
    await waitFor(() => {
      expect(result.current.data).toBe('manual')
    })
  })

  it('reset clears data and error', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('x'))
    const { result } = renderHook(() => useQueryWithRetry(fetcher, [], true))
    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })
})
