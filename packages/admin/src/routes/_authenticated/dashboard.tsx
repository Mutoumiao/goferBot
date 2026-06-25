import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import { DashboardView } from '@/features/dashboard/components/DashboardView'
import type { DashboardData } from '@/features/dashboard/services'
import { getDashboardData } from '@/features/dashboard/services'
import { useQueryWithRetry } from '@/hooks/useQueryWithRetry'
import { ROUTES_REGISTER } from '@/router-register'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
  staticData: { meta: ROUTES_REGISTER.dashboard },
})

function DashboardPage() {
  const { data, loading, error, run } = useQueryWithRetry<DashboardData>(getDashboardData, [], true)

  const handleRefresh = useCallback(() => {
    void run()
  }, [run])

  return (
    <DashboardView
      data={data ?? undefined}
      loading={loading}
      error={error}
      onRefresh={handleRefresh}
    />
  )
}
