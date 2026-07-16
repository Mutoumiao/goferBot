import type { ObservabilityDetail, ObservabilityWindow } from '@goferbot/data'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { ObservabilityDetailView } from '@/features/observability/components/ObservabilityDetailView'
import { getCompanionObservability } from '@/features/observability/services'
import { useQueryWithRetry } from '@/hooks/useQueryWithRetry'
import { ROUTES_REGISTER } from '@/router-register'

export const Route = createFileRoute('/_authenticated/observability/companion')({
  component: CompanionObservabilityPage,
  staticData: { meta: ROUTES_REGISTER.observabilityCompanion },
  validateSearch: (search: Record<string, unknown>): { window?: ObservabilityWindow } => {
    const w = search.window
    if (w === '1h' || w === '24h' || w === '7d') return { window: w }
    return {}
  },
})

function CompanionObservabilityPage() {
  const search = Route.useSearch()
  const [window, setWindow] = useState<ObservabilityWindow>(search.window ?? '24h')
  const fetcher = useCallback(() => getCompanionObservability(window), [window])
  const { data, loading, error, run } = useQueryWithRetry<ObservabilityDetail>(
    fetcher,
    [window],
    true,
  )

  return (
    <ObservabilityDetailView
      title="Companion 观测"
      description="延迟、情绪、质量与安全硬中断（硬中断不出现在聊天记录）"
      data={data ?? undefined}
      loading={loading}
      error={error}
      window={window}
      onWindowChange={setWindow}
      onRefresh={() => void run()}
      sectionOrder={['latency', 'retrieval', 'emotion', 'cost_safety']}
      sectionLabels={{
        latency: '延迟',
        retrieval: '检索质量',
        emotion: '情绪分布',
        cost_safety: '成本与安全',
      }}
    />
  )
}
