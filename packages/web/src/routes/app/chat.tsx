import { createFileRoute } from '@tanstack/react-router'
import { ChatHome } from './chat/ChatHome'

export const Route = createFileRoute('/app/chat')({
  component: ChatHome,
})
