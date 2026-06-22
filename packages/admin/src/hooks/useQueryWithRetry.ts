import { useCallback, useEffect, useRef, useState } from 'react'
import { mapErrorMessage } from '@/utils/error-mapper'

export interface UseQueryWithRetryState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export interface UseQueryWithRetryResult<T> extends UseQueryWithRetryState<T> {
  run: () => Promise<void>
  reset: () => void
}

/**
 * 统一的带 Loading/Error/Retry 三态的数据查询 Hook。
 * - 自动捕获异常并映射为中文错误信息
 * - 提供 run/reset 方法用于手动触发或重置
 * - 支持依赖数组变化时自动执行
 */
export function useQueryWithRetry<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  immediate = true,
): UseQueryWithRetryResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcherRef.current()
      if (mountedRef.current) {
        setData(result)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(mapErrorMessage(err))
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    if (immediate) {
      void run()
    }
    return () => {
      mountedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error, run, reset }
}
