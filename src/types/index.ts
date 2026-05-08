export interface Session {
  id: string
  title: string
  provider: string | null
  model: string | null
  created_at: number
  updated_at: number
  message_count: number
}

export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: number
}

export interface LLMConfig {
  provider: string
  model: string
  baseUrl: string
  apiKey: string
}

export interface ChatRequest {
  message: string
  sessionId: string
  knowledgeBaseIds?: string[]
  config: LLMConfig
}

export type TabType = 'chat' | 'knowledgeBase' | 'history' | 'settings'

export interface KnowledgeBase {
  id: string
  name: string
  path: string
  created_at: number
  deleted_at: number | null
  is_pinned: number
  sort_order: number
  icon: string
}

export interface FileItem {
  name: string
  type: 'file' | 'directory'
  size?: number
  updatedAt: number
}

export interface SearchResultItem extends FileItem {
  relativePath: string
}

export interface BrowseState {
  type: 'browse'
  path: string
}

export interface SearchState {
  type: 'search'
  query: string
}

export type HistoryEntry = BrowseState | SearchState

export interface Tab {
  id: string
  type: TabType
  title: string
  sessionId?: string
  closable: boolean
}
