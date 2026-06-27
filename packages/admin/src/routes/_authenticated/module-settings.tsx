import { createFileRoute } from '@tanstack/react-router'
import { ModuleSettingsLayout } from '@/features/module-settings/components/ModuleSettingsLayout'

export const Route = createFileRoute('/_authenticated/module-settings')({
  component: ModuleSettingsLayout,
})
