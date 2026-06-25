import { alovaInstance } from '@/utils/server'

export interface SessionItem {
  id: string
  title: string
  userId: string
  userEmail: string
  model: string
  messageCount: number
  status: 'active' | 'archived' | 'stopped'
  createdAt: string
  updatedAt: string
}

export interface SessionMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
  tokenCount?: number
  retrievalDocs?: Array<{
    id: string
    name: string
    score: number
    snippet: string
  }>
}

export interface ListSessionsQuery {
  page?: number
  pageSize?: number
  userId?: string
  model?: string
  status?: string
  startDate?: string
  endDate?: string
}

export const listSessions = (query: ListSessionsQuery = {}) =>
  alovaInstance.Get<{ items: SessionItem[]; total: number }>('/admin/sessions', {
    params: query,
  })

export const getSession = (id: string) => alovaInstance.Get<SessionItem>(`/admin/sessions/${id}`)

export const listSessionMessages = (sessionId: string) =>
  alovaInstance.Get<SessionMessage[]>(`/admin/sessions/${sessionId}/messages`)
