import { createFileRoute } from '@tanstack/react-router'
import { ChatHistoryPage } from '@/features/chat/components/ChatHistoryPage'
import { ROUTES_REGISTER } from '@/router-register'

export const Route = createFileRoute('/_authenticated/history')({
  component: ChatHistoryPage,
  staticData: {
    meta: ROUTES_REGISTER.history,
  },
})
