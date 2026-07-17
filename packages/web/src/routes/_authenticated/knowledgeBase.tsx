import { createFileRoute } from '@tanstack/react-router'
import { KnowledgeBasePage } from '@/features/KnowledgeBase/components/KnowledgeBasePage'
import { ROUTES_REGISTER } from '@/router-register'

/**
 * /knowledgeBase — 知识库一级页。
 * 选中库由 kbStore.selectedId 管理，不再使用 ?kb=。
 */
export const Route = createFileRoute('/_authenticated/knowledgeBase')({
  component: KnowledgeBasePage,
  staticData: {
    meta: ROUTES_REGISTER.knowledgeBase,
    keepAlive: true,
  },
})
