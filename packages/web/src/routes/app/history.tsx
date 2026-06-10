import { createFileRoute } from '@tanstack/react-router'
import { ChatHistoryPage } from '@/features/chat/components/ChatHistoryPage'

export const Route = createFileRoute('/app/history')({
  component: ChatHistoryPage,
})
