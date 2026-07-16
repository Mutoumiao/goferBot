import type { HubHealth } from '@goferbot/data'
import { Tooltip } from 'antd'
import { Activity, Gauge } from 'lucide-react'

const STATUS_LABEL: Record<HubHealth['status'], string> = {
  ok: '正常',
  degraded: '降级',
  down: '故障',
}

function overallStatusClass(status: HubHealth['status']): string {
  if (status === 'ok') return 'obs-status--ready'
  if (status === 'degraded') return 'obs-status--partial'
  return 'obs-status--down'
}

function chipStatusClass(status: HubHealth['status']): string {
  if (status === 'ok') return 'obs-status--ready'
  if (status === 'degraded') return 'obs-status--partial'
  return 'obs-status--down'
}

export interface HealthBarProps {
  health?: HubHealth
}

export function HealthBar({ health }: HealthBarProps) {
  if (!health) {
    return (
      <section className="obs-panel obs-rise">
        <div className="obs-panel__head">
          <h2 className="obs-panel__title">
            <Activity size={14} strokeWidth={2.25} />
            依赖健康
          </h2>
        </div>
        <div className="obs-panel__body">
          <div className="text-sm" style={{ color: 'var(--obs-faint)' }}>
            健康状态加载中…
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="obs-panel obs-rise">
      <div className="obs-panel__head">
        <h2 className="obs-panel__title">
          <Activity size={14} strokeWidth={2.25} />
          依赖健康
        </h2>
        <span className={`obs-status ${overallStatusClass(health.status)}`}>
          <span className="obs-status__dot" aria-hidden />
          {STATUS_LABEL[health.status]}
        </span>
      </div>
      <div className="obs-panel__body obs-health">
        <div className="obs-health__row">
          {health.components.map((c) => (
            <Tooltip
              key={c.name}
              title={
                typeof c.latencyMs === 'number'
                  ? `延迟 ${c.latencyMs} ms · ${STATUS_LABEL[c.status]}`
                  : STATUS_LABEL[c.status]
              }
            >
              <div className="obs-chip">
                <span className={`obs-status ${chipStatusClass(c.status)}`} style={{ padding: 0, border: 0, background: 'transparent' }}>
                  <span className="obs-status__dot" aria-hidden />
                </span>
                <span className="obs-chip__name">{c.name}</span>
                {typeof c.latencyMs === 'number' && (
                  <span className="obs-chip__lat">{c.latencyMs}ms</span>
                )}
              </div>
            </Tooltip>
          ))}
        </div>
        <div className="obs-health__footer">
          {health.slowest && (
            <span className="inline-flex items-center gap-1.5">
              <Gauge size={12} />
              最慢组件：{health.slowest.name}（{health.slowest.latencyMs} ms）
            </span>
          )}
          <span>{health.components.length} deps</span>
        </div>
      </div>
    </section>
  )
}
