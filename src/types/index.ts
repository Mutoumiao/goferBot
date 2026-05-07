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

export interface Tab {
  id: string
  type: TabType
  title: string
  sessionId?: string
  closable: boolean
}
