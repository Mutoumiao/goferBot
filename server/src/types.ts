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
  knowledge_base_ids: string | null
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

export interface ImportFile {
  name: string
  content: string
}
