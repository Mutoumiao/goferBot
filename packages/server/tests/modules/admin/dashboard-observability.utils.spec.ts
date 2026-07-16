import { describe, expect, it } from 'vitest'
import {
  approximateP95,
  buildCountKpi,
  buildP95Kpi,
  buildRateKpi,
  parseJsonObject,
  qualityIsFail,
  windowStart,
  windowToMs,
} from '@/modules/admin/services/dashboard-observability.utils.js'

describe('dashboard-observability.utils', () => {
  describe('window', () => {
    it('maps window to milliseconds', () => {
      expect(windowToMs('1h')).toBe(3_600_000)
      expect(windowToMs('24h')).toBe(86_400_000)
      expect(windowToMs('7d')).toBe(604_800_000)
    })

    it('windowStart is before now by window size', () => {
      const now = new Date('2026-07-16T12:00:00.000Z')
      const start = windowStart('1h', now)
      expect(start.toISOString()).toBe('2026-07-16T11:00:00.000Z')
    })
  })

  describe('buildRateKpi', () => {
    it('pending when not instrumented', () => {
      const kpi = buildRateKpi({
        numerator: 1,
        denominator: 10,
        instrumented: false,
      })
      expect(kpi.status).toBe('pending_instrumentation')
      expect(kpi.value).toBeUndefined()
    })

    it('insufficient when denominator below min', () => {
      const kpi = buildRateKpi({
        numerator: 0,
        denominator: 0,
        instrumented: true,
      })
      expect(kpi.status).toBe('insufficient_samples')
    })

    it('negative/feedbackCount rate', () => {
      const kpi = buildRateKpi({
        numerator: 2,
        denominator: 10,
        instrumented: true,
      })
      expect(kpi.status).toBe('ready')
      expect(kpi.value).toBeCloseTo(0.2)
      expect(kpi.sampleSize).toBe(10)
    })

    it('marks partial when scan limited', () => {
      const kpi = buildRateKpi({
        numerator: 1,
        denominator: 100,
        instrumented: true,
        partial: true,
      })
      expect(kpi.partial).toBe(true)
    })
  })

  describe('approximateP95', () => {
    it('returns null for empty', () => {
      expect(approximateP95([])).toBeNull()
    })

    it('returns sole sample', () => {
      expect(approximateP95([42])).toBe(42)
    })

    it('returns high percentile for sorted range', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1)
      const p95 = approximateP95(values)
      expect(p95).toBeGreaterThanOrEqual(95)
      expect(p95).toBeLessThanOrEqual(100)
    })
  })

  describe('buildP95Kpi / buildCountKpi', () => {
    it('p95 pending without instrumentation', () => {
      expect(buildP95Kpi([100], false).status).toBe('pending_instrumentation')
    })

    it('p95 insufficient without samples', () => {
      expect(buildP95Kpi([], true).status).toBe('insufficient_samples')
    })

    it('p95 ready with samples', () => {
      const kpi = buildP95Kpi([10, 20, 30, 40, 50], true)
      expect(kpi.status).toBe('ready')
      expect(kpi.unit).toBe('ms')
      expect(typeof kpi.value).toBe('number')
    })

    it('count kpi ready', () => {
      expect(buildCountKpi(3)).toEqual({ status: 'ready', value: 3, partial: undefined })
    })
  })

  describe('metadata helpers', () => {
    it('parses string JSON and objects', () => {
      expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 })
      expect(parseJsonObject({ b: 2 })).toEqual({ b: 2 })
      expect(parseJsonObject('not-json')).toBeNull()
    })

    it('detects quality fail', () => {
      expect(qualityIsFail({ quality: { status: 'fail' } })).toBe(true)
      expect(qualityIsFail({ quality: { status: 'pass' } })).toBe(false)
      expect(qualityIsFail(null)).toBe(false)
    })
  })
})
