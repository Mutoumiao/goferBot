import { createFileRoute } from '@tanstack/react-router'
import { KnowledgeBasePage } from '@/features/KnowledgeBase/components/KnowledgeBasePage'

export const Route = createFileRoute('/_authenticated/knowledgeBase')({
  component: KnowledgeBasePage,
  staticData: {
    tabMeta: {
      title: '知识库',
      singleton: true,
      closable: true,
      icon: 'BookOpen',
      navSection: 'primary',
    },
  },
})
