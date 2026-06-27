import { createFileRoute } from '@tanstack/react-router'
import { ProviderList } from '@/features/model-providers/components/ProviderList'

export const Route = createFileRoute('/_authenticated/model-providers')({
  component: ProviderList,
})
