import { createFileRoute } from '@tanstack/react-router'
import { ChatHistoryPage } from '@/features/chat/components/ChatHistoryPage'

export const Route = createFileRoute('/_authenticated/history')({
  component: ChatHistoryPage,
  staticData: {
    tabMeta: {
      title: '会话管理',
      singleton: true,
      closable: true,
      icon: 'Clock',
      navSection: 'primary',
    },
  },
})
