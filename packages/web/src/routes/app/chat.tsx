import { createFileRoute } from '@tanstack/react-router'
import { ChatHome } from '@/features/chat/components/ChatHome'

export const Route = createFileRoute('/app/chat')({
  component: ChatHome,
})
