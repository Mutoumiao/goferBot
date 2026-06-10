import { createFileRoute } from '@tanstack/react-router'
import { ChatHome } from '@/features/chat/components/ChatHome'

export const Route = createFileRoute('/app/chat')({
  component: ChatHome,
  staticData: {
    tabMeta: {
      title: '问答首页',
      singleton: true,
      closable: false,
    },
  },
})
