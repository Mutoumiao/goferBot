import type { Message, Session } from '@goferbot/data'

export interface ChatState {
  activeSession: Session | null
  messages: Message[]
  isLoadingHistory: boolean
  isStreaming: boolean
  streamingContent: string
  sessions: Session[]
  isLoadingSessions: boolean
  error: string | null
}
