import { createFileRoute } from '@tanstack/react-router'
import { KnowledgeBasePage } from '@/features/kb/components/KnowledgeBasePage'

export const Route = createFileRoute('/app/kb')({
  component: KnowledgeBasePage,
  staticData: {
    tabMeta: {
      title: '知识库',
      singleton: true,
      closable: true,
    },
  },
})
