import { createFileRoute } from '@tanstack/react-router'
import { DashboardView } from '@/features/dashboard/components/DashboardView'
import type { DashboardData } from '@/features/dashboard/services'
import { getDashboardData } from '@/features/dashboard/services'
import { ROUTES_REGISTER } from '@/router-register'
import { useCallback, useEffect, useState } from 'react'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
  staticData: { meta: ROUTES_REGISTER.dashboard },
})

function DashboardPage() {
  const [data, setData] = useState<DashboardData | undefined>()
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await getDashboardData()
      setData(d)
    } catch {
      setData(undefined)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return <DashboardView data={data} loading={loading} onRefresh={() => void load()} />
}
