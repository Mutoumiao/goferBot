import type { ObservabilityDetail, ObservabilityWindow } from '@goferbot/data'
import { fetchCompanionObservability, fetchRagObservability } from '@/api/dashboard'

export async function getRagObservability(
  window: ObservabilityWindow = '24h',
): Promise<ObservabilityDetail> {
  return fetchRagObservability(window).send()
}

export async function getCompanionObservability(
  window: ObservabilityWindow = '24h',
): Promise<ObservabilityDetail> {
  return fetchCompanionObservability(window).send()
}
