import type { ObservabilityDetail, ObservabilityWindow } from '@goferbot/data'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { ObservabilityDetailView } from '@/features/observability/components/ObservabilityDetailView'
import { getRagObservability } from '@/features/observability/services'
import { useQueryWithRetry } from '@/hooks/useQueryWithRetry'
import { ROUTES_REGISTER } from '@/router-register'

export const Route = createFileRoute('/_authenticated/observability/rag')({
  component: RagObservabilityPage,
  staticData: { meta: ROUTES_REGISTER.observabilityRag },
  validateSearch: (search: Record<string, unknown>): { window?: ObservabilityWindow } => {
    const w = search.window
    if (w === '1h' || w === '24h' || w === '7d') return { window: w }
    return {}
  },
})

function RagObservabilityPage() {
  const search = Route.useSearch()
  const [window, setWindow] = useState<ObservabilityWindow>(search.window ?? '24h')
  const fetcher = useCallback(() => getRagObservability(window), [window])
  const { data, loading, error, run } = useQueryWithRetry<ObservabilityDetail>(
    fetcher,
    [window],
    true,
  )

  return (
    <ObservabilityDetailView
      title="RAG 观测"
      description="索引失败、检索空结果/降级与依赖健康分块"
      data={data ?? undefined}
      loading={loading}
      error={error}
      window={window}
      onWindowChange={setWindow}
      onRefresh={() => void run()}
      sectionOrder={['index', 'retrieve', 'quality_deps']}
      sectionLabels={{
        index: '索引',
        retrieve: '检索',
        quality_deps: '质量依赖',
      }}
    />
  )
}
