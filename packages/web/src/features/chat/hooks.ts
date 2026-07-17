/**
 * Chat 会话列表 hooks。
 *
 * 基于 alova 的 useRequest 封装，统一处理分页、加载态、错误和刷新。
 * - useChatHistory: 立即加载
 * - useLazyChatHistory: 手动触发（`ChatsPage` 使用，避免 Keep-Alive 误请求）
 */
import type { Pagination as PaginationType, Session, SessionListResponse } from '@goferbot/data'
import { useRequest } from 'alova/client'
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

  const responseData = data as SessionListResponse | undefined
  const sessions = responseData?.items ?? []
  const pagination = responseData?.pagination ?? null

  // 直接返回 send，勿包进随 loading/data 重建的 useMemo（与 useLazyChatHistory 一致）
  return {
    sessions,
    pagination,
    loading,
    error,
    reload: reload as ChatHistoryResult['reload'],
  }
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

  const responseData = data as SessionListResponse | undefined
  const sessions = responseData?.items ?? []
  const pagination = responseData?.pagination ?? null

  // 直接返回 send 引用，勿包进随 loading/data 重建的 useMemo，
  // 否则调用方 useEffect([load]) 会在每次请求后再次触发 → 死循环。
  return {
    sessions,
    pagination,
    loading,
    error,
    reload: load as LazyChatHistoryResult['reload'],
    load: load as LazyChatHistoryResult['load'],
  }
}
