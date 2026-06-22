import { createFileRoute } from '@tanstack/react-router'
import { ModelList } from '@/features/models/components/ModelList'

export const Route = createFileRoute('/_authenticated/models')({
  component: ModelList,
})
