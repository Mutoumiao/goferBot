import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '@/features/settings/components/SettingsPage'
import { ROUTES_REGISTER } from '@/router-register'

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
  staticData: {
    meta: ROUTES_REGISTER.settings,
    keepAlive: true,
  },
})
