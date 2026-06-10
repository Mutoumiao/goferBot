import { useMemo } from 'react'
import { useRequest } from 'alova/client'
import { getSessions } from '@/api/chat'
import type { Session } from '@goferbot/data'

export interface ChatHistoryResult {
  sessions: Session[]
  total: number
  loading: boolean
  error: Error | undefined
  reload: () => Promise<any>
}

export function useChatHistory(page: number, pageSize: number): ChatHistoryResult {
  const { data, loading, error, send: reload } = useRequest(
    () => getSessions(page, pageSize),
    { immediate: true },
  )

  return useMemo(() => {
    const sessions = (data as { sessions?: Session[] } | undefined)?.sessions ?? []
    const total =
      (data as { total?: number } | undefined)?.total ?? sessions.length
    return { sessions, total, loading, error, reload }
  }, [data, loading, error, reload])
}
