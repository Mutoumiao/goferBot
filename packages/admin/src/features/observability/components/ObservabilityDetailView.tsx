import type { ObservabilityDetail, ObservabilityWindow } from '@goferbot/data'
import { Alert, Button, Empty, Segmented } from 'antd'
import { ArrowLeft, Layers, RefreshCw } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { PageHeader } from '@/components/common/PageHeader'
import { KpiCard } from '@/features/dashboard/components/KpiCard'
import '@/features/dashboard/obs-console.css'

export interface ObservabilityDetailViewProps {
  title: string
  description?: string
  data?: ObservabilityDetail
  loading?: boolean
  error?: string | null
  window?: ObservabilityWindow
  onWindowChange?: (w: ObservabilityWindow) => void
  onRefresh?: () => void
  sectionOrder: string[]
  sectionLabels: Record<string, string>
}

function sectionStatusClass(status: string): string {
  if (status === 'ready') return 'obs-status--ready'
  if (status === 'partial') return 'obs-status--partial'
  if (status === 'insufficient_samples') return 'obs-status--insufficient'
  return 'obs-status--pending'
}

function sectionStatusLabel(status: string): string {
  if (status === 'ready') return '就绪'
  if (status === 'partial') return '部分'
  if (status === 'insufficient_samples') return '样本不足'
  return '待埋点'
}

function formatMetricValue(value?: number, unit?: string): string {
  if (value == null) return '—'
  if (unit === 'ratio') return `${(value * 100).toFixed(1)}%`
  if (unit === 'ms') return `${Math.round(value)} ms`
  return String(value)
}

export function ObservabilityDetailView({
  title,
  description,
  data,
  loading,
  error,
  window = '24h',
  onWindowChange,
  onRefresh,
  sectionOrder,
  sectionLabels,
}: ObservabilityDetailViewProps) {
  return (
    <div className="obs-console space-y-5">
      <PageHeader
        title={title}
        description={description}
        extra={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/dashboard">
              <Button icon={<ArrowLeft size={14} />}>返回控制台</Button>
            </Link>
            <Segmented
              value={window}
              onChange={(v) => onWindowChange?.(v as ObservabilityWindow)}
              options={[
                { label: '1 小时', value: '1h' },
                { label: '24 小时', value: '24h' },
                { label: '7 天', value: '7d' },
              ]}
            />
            <Button icon={<RefreshCw size={14} />} onClick={onRefresh} loading={loading}>
              刷新
            </Button>
          </div>
        }
      />

      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          action={
            <Button size="small" type="primary" onClick={onRefresh}>
              重试
            </Button>
          }
        />
      )}

      <div aria-busy={loading || undefined} className="space-y-5">
        {data?.kpis && data.kpis.length > 0 && (
          <section className="obs-panel obs-rise">
            <div className="obs-panel__head">
              <h2 className="obs-panel__title">
                <Layers size={14} />
                顶栏 KPI
              </h2>
              <span className="obs-panel__badge">{data.kpis.length} signals</span>
            </div>
            <div className="obs-panel__body">
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {data.kpis.map((kpi, idx) => (
                  <KpiCard
                    key={kpi.key ?? idx}
                    title={kpi.label ?? kpi.key ?? `KPI ${idx + 1}`}
                    kpi={kpi}
                    format={
                      kpi.unit === 'ms'
                        ? 'ms'
                        : kpi.key?.toLowerCase().includes('count')
                          ? 'count'
                          : 'ratio'
                    }
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        <div className="space-y-3">
          {sectionOrder.map((key, i) => {
            const section = data?.sections?.[key]
            return (
              <section
                key={key}
                className={`obs-panel obs-rise obs-rise-${Math.min(i + 1, 4)}`}
              >
                <div className="obs-panel__head">
                  <h3 className="obs-panel__title m-0">
                    {sectionLabels[key] ?? key}
                  </h3>
                  {section && (
                    <span className={`obs-status ${sectionStatusClass(section.status)}`}>
                      <span className="obs-status__dot" aria-hidden />
                      {sectionStatusLabel(section.status)}
                    </span>
                  )}
                </div>
                <div className="obs-panel__body">
                  {!section ? (
                    <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : section.status === 'pending_instrumentation' &&
                    section.metrics.length === 0 ? (
                    <p className="m-0 text-sm" style={{ color: 'var(--obs-muted)' }}>
                      {section.note ?? '该分块尚未接入真实数据源，不展示虚构指标。'}
                    </p>
                  ) : (
                    <>
                      {section.note && (
                        <p
                          className="mb-3 text-xs leading-relaxed"
                          style={{ color: 'var(--obs-faint)' }}
                        >
                          {section.note}
                        </p>
                      )}
                      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        {section.metrics.map((m) => (
                          <div key={m.key} className="obs-metric-tile">
                            <div className="mb-1 flex items-start justify-between gap-2">
                              <span className="obs-metric-tile__key">{m.key}</span>
                              <span className={`obs-status ${sectionStatusClass(m.status)}`}>
                                <span className="obs-status__dot" aria-hidden />
                                {sectionStatusLabel(m.status)}
                              </span>
                            </div>
                            <div className="obs-metric-tile__value">
                              {formatMetricValue(m.value, m.unit)}
                            </div>
                            {m.note && <div className="obs-metric-tile__note">{m.note}</div>}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </section>
            )
          })}
        </div>

        <div className="obs-meta">
          <span>
            {data?.generatedAt
              ? `生成于 ${new Date(data.generatedAt).toLocaleString()}`
              : '等待聚合…'}
          </span>
          <span>窗口 {data?.window ?? window}</span>
        </div>
      </div>
    </div>
  )
}
