import type { Kpi, ObservabilityWindow } from '@goferbot/data'

export const DEFAULT_METADATA_SCAN_LIMIT = 10_000
export const MIN_SAMPLES_FOR_RATE = 1

export type KpiStatus = Kpi['status']

export interface RateKpiInput {
  numerator: number
  denominator: number
  /** 是否已有埋点能力（字段/事件表） */
  instrumented: boolean
  minSamples?: number
  partial?: boolean
  note?: string
}

export function windowToMs(window: ObservabilityWindow): number {
  switch (window) {
    case '1h':
      return 60 * 60 * 1000
    case '7d':
      return 7 * 24 * 60 * 60 * 1000
    default:
      return 24 * 60 * 60 * 1000
  }
}

export function windowStart(window: ObservabilityWindow, now = new Date()): Date {
  return new Date(now.getTime() - windowToMs(window))
}

/**
 * 负反馈率：negative / feedbackCount
 * 硬中断率：events / userMessages
 * 通用 rate KPI 构造
 */
export function buildRateKpi(input: RateKpiInput): Kpi {
  const min = input.minSamples ?? MIN_SAMPLES_FOR_RATE
  if (!input.instrumented) {
    return {
      status: 'pending_instrumentation',
      note: input.note,
    }
  }
  if (input.denominator < min) {
    return {
      status: 'insufficient_samples',
      sampleSize: input.denominator,
      note: input.note,
      partial: input.partial,
    }
  }
  const value = input.numerator / input.denominator
  return {
    status: 'ready',
    value,
    sampleSize: input.denominator,
    partial: input.partial,
    note: input.note,
  }
}

export function buildCountKpi(count: number, instrumented = true, partial = false): Kpi {
  if (!instrumented) {
    return { status: 'pending_instrumentation' }
  }
  return {
    status: 'ready',
    value: count,
    partial: partial || undefined,
  }
}

/** 近似 P95：排序后取 ceil(0.95 * n) - 1 下标 */
export function approximateP95(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(0.95 * sorted.length) - 1))
  return sorted[idx]!
}

export function buildP95Kpi(values: number[], instrumented: boolean, partial = false): Kpi {
  if (!instrumented) {
    return { status: 'pending_instrumentation' }
  }
  if (values.length === 0) {
    return { status: 'insufficient_samples', sampleSize: 0, partial }
  }
  const p95 = approximateP95(values)
  return {
    status: 'ready',
    value: p95 ?? undefined,
    unit: 'ms',
    sampleSize: values.length,
    partial: partial || undefined,
  }
}

export function parseJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return null
    }
  }
  return null
}

export function isTruthyFlag(meta: Record<string, unknown> | null, key: string): boolean {
  if (!meta) return false
  return meta[key] === true
}

export function readNumberField(meta: Record<string, unknown> | null, key: string): number | null {
  if (!meta) return null
  const v = meta[key]
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v
  return null
}

export function qualityIsFail(meta: Record<string, unknown> | null): boolean {
  if (!meta) return false
  const quality = meta.quality
  if (!quality || typeof quality !== 'object' || Array.isArray(quality)) return false
  return (quality as { status?: string }).status === 'fail'
}

export function hasQualitySnapshot(meta: Record<string, unknown> | null): boolean {
  if (!meta) return false
  return meta.quality != null && typeof meta.quality === 'object'
}
