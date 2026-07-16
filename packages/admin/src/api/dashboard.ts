import type {
  DashboardSummary,
  ObservabilityDetail,
  ObservabilityWindow,
} from '@goferbot/data'
import { alovaInstance } from '@/utils/server'

export type { DashboardSummary, ObservabilityDetail, ObservabilityWindow }

export const fetchDashboardSummary = (window: ObservabilityWindow = '24h') =>
  alovaInstance.Get<DashboardSummary>('/admin/dashboard/summary', {
    params: { window },
  })

export const fetchRagObservability = (window: ObservabilityWindow = '24h') =>
  alovaInstance.Get<ObservabilityDetail>('/admin/observability/rag', {
    params: { window },
  })

export const fetchCompanionObservability = (window: ObservabilityWindow = '24h') =>
  alovaInstance.Get<ObservabilityDetail>('/admin/observability/companion', {
    params: { window },
  })
