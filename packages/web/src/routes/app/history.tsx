import { createFileRoute } from '@tanstack/react-router'
import { ChatHistoryPage } from '@/features/chat/components/ChatHistoryPage'

export const Route = createFileRoute('/app/history')({
  component: ChatHistoryPage,
  staticData: {
    tabMeta: {
      title: '会话管理',
      singleton: true,
      closable: true,
    },
  },
})
