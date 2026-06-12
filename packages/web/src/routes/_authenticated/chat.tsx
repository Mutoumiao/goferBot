import { createFileRoute } from '@tanstack/react-router'
import { ChatHome } from '@/features/chat/components/ChatHome'
import { ROUTES_REGISTER } from '@/router-register'

export const Route = createFileRoute('/_authenticated/chat')({
  component: ChatHome,
  staticData: {
    meta: ROUTES_REGISTER.chat,
  },
})
