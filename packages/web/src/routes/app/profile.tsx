import { createFileRoute } from '@tanstack/react-router'
import { ProfilePage } from '@/features/auth/components/ProfilePage'

export const Route = createFileRoute('/app/profile')({
  component: ProfilePage,
  staticData: {
    tabMeta: {
      title: '基础信息',
      singleton: true,
      closable: true,
    },
  },
})
