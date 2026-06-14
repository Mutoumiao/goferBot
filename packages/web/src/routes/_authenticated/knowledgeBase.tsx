import { createFileRoute } from '@tanstack/react-router'
import { KnowledgeBasePage } from '@/features/KnowledgeBase/components/KnowledgeBasePage'
import { ROUTES_REGISTER } from '@/router-register'

export const Route = createFileRoute('/_authenticated/knowledgeBase')({
  component: KnowledgeBasePage,
  staticData: {
    meta: ROUTES_REGISTER.knowledgeBase,
  },
})
