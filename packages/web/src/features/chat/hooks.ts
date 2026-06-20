/**
 * Chat 历史会话相关 hooks。
 *
 * 基于 alova 的 useRequest 封装，统一处理分页、加载态、错误和刷新。
 * - useChatHistory: 立即加载，适合已挂载就需要数据的场景
 * - useLazyChatHistory: 手动触发加载，适合需要控制加载时机的场景（如历史页）
 */
import type { Pagination as PaginationType, Session, SessionListResponse } from '@goferbot/data'
import { useRequest } from 'alova/client'
import { useMemo } from 'react'
import { getSessions } from '@/api/chat'

export interface ChatHistoryResult {
  sessions: Session[]
  pagination: PaginationType | null
  loading: boolean
  error: Error | undefined
  reload: () => Promise<SessionListResponse | undefined>
}

/** 立即加载会话历史 */
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
    return { sessions, pagination, loading, error, reload: reload as ChatHistoryResult['reload'] }
  }, [data, loading, error, reload])
}

export interface LazyChatHistoryResult extends ChatHistoryResult {
  load: () => Promise<SessionListResponse | undefined>
}

/** 延迟加载会话历史，调用 load/reload 触发请求 */
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
    return {
      sessions,
      pagination,
      loading,
      error,
      reload: load as LazyChatHistoryResult['reload'],
      load: load as LazyChatHistoryResult['load'],
    }
  }, [data, loading, error, load])
}
