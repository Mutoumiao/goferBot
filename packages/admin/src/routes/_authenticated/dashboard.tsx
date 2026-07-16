import type { ObservabilityWindow } from '@goferbot/data'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { DashboardView } from '@/features/dashboard/components/DashboardView'
import type { DashboardSummary } from '@/features/dashboard/services'
import { getDashboardSummary } from '@/features/dashboard/services'
import { useQueryWithRetry } from '@/hooks/useQueryWithRetry'
import { ROUTES_REGISTER } from '@/router-register'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
  staticData: { meta: ROUTES_REGISTER.dashboard },
})

function DashboardPage() {
  const [window, setWindow] = useState<ObservabilityWindow>('24h')
  const fetcher = useCallback(() => getDashboardSummary(window), [window])
  const { data, loading, error, run } = useQueryWithRetry<DashboardSummary>(fetcher, [window], true)

  const handleRefresh = useCallback(() => {
    void run()
  }, [run])

  return (
    <DashboardView
      data={data ?? undefined}
      loading={loading}
      error={error}
      window={window}
      onWindowChange={setWindow}
      onRefresh={handleRefresh}
    />
  )
}
