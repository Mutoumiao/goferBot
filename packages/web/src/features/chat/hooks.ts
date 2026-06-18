import type { Pagination as PaginationType, Session, SessionListResponse } from '@goferbot/data'
import { useRequest } from 'alova/client'
import { useMemo } from 'react'
import { getSessions } from '@/api/chat'

export interface ChatHistoryResult {
  sessions: Session[]
  pagination: PaginationType | null
  loading: boolean
  error: Error | undefined
  reload: () => Promise<any>
}

export function useChatHistory(page: number, pageSize: number): ChatHistoryResult {
  const {
    data,
    loading,
    error,
    send: reload,
  } = useRequest(() => getSessions(page, pageSize), { immediate: true })

  return useMemo(() => {
    const responseData = data as SessionListResponse | undefined
    const sessions = responseData?.items ?? []
    const pagination = responseData?.pagination ?? null
    return { sessions, pagination, loading, error, reload }
  }, [data, loading, error, reload])
}

export interface LazyChatHistoryResult extends ChatHistoryResult {
  load: () => Promise<any>
}

export function useLazyChatHistory(page: number, pageSize: number): LazyChatHistoryResult {
  const {
    data,
    loading,
    error,
    send: load,
  } = useRequest(() => getSessions(page, pageSize), { immediate: false })

  return useMemo(() => {
    const responseData = data as SessionListResponse | undefined
    const sessions = responseData?.items ?? []
    const pagination = responseData?.pagination ?? null
    return { sessions, pagination, loading, error, reload: load, load }
  }, [data, loading, error, load])
}
