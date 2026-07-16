import type { Kpi } from '@goferbot/data'
import { Tooltip } from 'antd'

export interface KpiCardProps {
  title: string
  kpi?: Kpi
  description?: string
  format?: 'ratio' | 'count' | 'ms'
  extra?: React.ReactNode
}

function formatValue(kpi: Kpi, format: KpiCardProps['format']): string {
  if (kpi.status !== 'ready' || kpi.value == null) return '—'
  if (format === 'ratio') return `${(kpi.value * 100).toFixed(1)}%`
  if (format === 'ms') return `${Math.round(kpi.value)}`
  return String(kpi.value)
}

function formatUnit(kpi: Kpi, format: KpiCardProps['format']): string | null {
  if (kpi.status !== 'ready' || kpi.value == null) return null
  if (format === 'ms') return 'ms'
  if (format === 'count') return 'n'
  return null
}

function statusClass(kpi?: Kpi): string {
  if (!kpi) return 'obs-status--pending'
  if (kpi.status === 'ready' && kpi.partial) return 'obs-status--partial'
  if (kpi.status === 'ready') return 'obs-status--ready'
  if (kpi.status === 'pending_instrumentation') return 'obs-status--pending'
  return 'obs-status--insufficient'
}

function statusLabel(kpi?: Kpi): string {
  if (!kpi) return '加载'
  if (kpi.status === 'ready' && kpi.partial) return '部分'
  if (kpi.status === 'ready') return '就绪'
  if (kpi.status === 'pending_instrumentation') return '待埋点'
  return '样本不足'
}

function statusHint(kpi?: Kpi): string | undefined {
  if (!kpi) return undefined
  if (kpi.note) return kpi.note
  if (kpi.status === 'pending_instrumentation') return '指标尚未接入真实埋点，不展示虚构数值'
  if (kpi.status === 'insufficient_samples') return '时间窗内样本不足，暂不可计算可靠比率'
  if (kpi.partial) return '达到扫描上限，结果为部分聚合'
  return undefined
}

export function KpiCard({ title, kpi, description, format = 'ratio', extra }: KpiCardProps) {
  const hint = statusHint(kpi)
  const raw = kpi ? formatValue(kpi, format) : '—'
  const unit = kpi ? formatUnit(kpi, format) : null
  const muted = !kpi || kpi.status !== 'ready' || kpi.value == null

  return (
    <div className="obs-kpi">
      <div className="obs-kpi__top">
        <span className="obs-kpi__label">{title}</span>
        <span className={`obs-status ${statusClass(kpi)}`}>
          <span className="obs-status__dot" aria-hidden />
          {statusLabel(kpi)}
        </span>
      </div>

      <Tooltip title={hint}>
        <div
          className={`obs-kpi__value ${muted ? 'obs-kpi__value--muted' : ''}`}
          aria-label={`${title}: ${raw}${unit ?? ''}`}
        >
          {raw}
          {unit && !muted && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--obs-faint)',
              }}
            >
              {unit}
            </span>
          )}
        </div>
      </Tooltip>

      {(description || (kpi?.sampleSize != null && kpi.status === 'ready')) && (
        <div className="obs-kpi__meta">
          {description && <div>{description}</div>}
          {kpi?.sampleSize != null && kpi.status === 'ready' && (
            <div className="obs-mono">n={kpi.sampleSize.toLocaleString()}</div>
          )}
        </div>
      )}
      {extra}
    </div>
  )
}
