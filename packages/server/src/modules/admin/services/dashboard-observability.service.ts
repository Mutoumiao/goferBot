import { Injectable, Logger } from '@nestjs/common'
import type {
  DashboardSummary,
  HubHealth,
  Kpi,
  ObservabilityDetail,
  ObservabilitySection,
  ObservabilityWindow,
} from '@goferbot/data'
import { HealthService } from '../../health/health.service.js'
import { KnowledgeAiClient } from '../../../processors/knowledge-ai/knowledge-ai.client.js'
import { PrismaService } from '../../../processors/database/prisma.service.js'
import { COMPANION_OBS_SAFETY_HARD_STOP } from '../../companion/repositories/companion-obs-event.repository.js'
import {
  buildCountKpi,
  buildP95Kpi,
  buildRateKpi,
  DEFAULT_METADATA_SCAN_LIMIT,
  hasQualitySnapshot,
  isTruthyFlag,
  parseJsonObject,
  qualityIsFail,
  readNumberField,
  windowStart,
} from './dashboard-observability.utils.js'

const SCAN_TIMEOUT_MS = 8_000

type CompanionMetaAgg = {
  latencies: number[]
  latencyInstrumented: boolean
  qualityFailCount: number
  qualitySampleCount: number
  partial: boolean
  /** primaryEmotion → count（同次扫描附带，避免详页二次全表扫） */
  emotionCounts: Record<string, number>
  emotionSampleCount: number
}

@Injectable()
export class DashboardObservabilityService {
  private readonly logger = new Logger(DashboardObservabilityService.name)
  private readonly scanLimit =
    Number(process.env.DASHBOARD_METADATA_SCAN_LIMIT) || DEFAULT_METADATA_SCAN_LIMIT

  constructor(
    private readonly prisma: PrismaService,
    private readonly healthService: HealthService,
    private readonly knowledgeAi: KnowledgeAiClient,
  ) {}

  async getSummary(window: ObservabilityWindow = '24h'): Promise<DashboardSummary> {
    const since = windowStart(window)
    const [health, inventory, rag, companion] = await Promise.all([
      this.buildHealth(),
      this.buildInventory(),
      this.buildHubRag(since),
      this.buildHubCompanion(since),
    ])

    return {
      window,
      generatedAt: new Date().toISOString(),
      health,
      rag,
      companion,
      inventory,
    }
  }

  async getRagDetail(window: ObservabilityWindow = '24h'): Promise<ObservabilityDetail> {
    const since = windowStart(window)
    const [rag, health] = await Promise.all([this.buildHubRag(since), this.buildHealth()])
    const kpis: Kpi[] = [
      { key: 'emptyRate', label: '检索空结果率', ...rag.emptyRate },
      { key: 'degradedRate', label: '降级率', ...rag.degradedRate },
      { key: 'indexFailureCount', label: '索引失败数', ...rag.indexFailureCount },
    ]

    const retrievePartial = Boolean(rag.emptyRate.partial || rag.degradedRate.partial)
    const retrieveReady =
      rag.emptyRate.status === 'ready' ||
      rag.degradedRate.status === 'ready' ||
      rag.emptyRate.status === 'insufficient_samples' ||
      rag.degradedRate.status === 'insufficient_samples'

    const sections: Record<string, ObservabilitySection> = {
      index: {
        status: rag.indexFailureCount.status === 'ready' ? 'ready' : 'pending_instrumentation',
        metrics: [
          {
            key: 'index_failure_count',
            status: rag.indexFailureCount.status,
            value: rag.indexFailureCount.value,
            unit: 'count',
          },
        ],
        note: '口径：Document.status=failed 且 updatedAt 落在时间窗内',
      },
      retrieve: {
        status: retrieveReady
          ? retrievePartial
            ? 'partial'
            : 'ready'
          : 'pending_instrumentation',
        metrics: [
          {
            key: 'empty_rate',
            status: rag.emptyRate.status,
            value: rag.emptyRate.value,
            unit: 'ratio',
            note: rag.emptyRate.note,
          },
          {
            key: 'degraded_rate',
            status: rag.degradedRate.status,
            value: rag.degradedRate.value,
            unit: 'ratio',
            note: rag.degradedRate.note,
          },
        ],
      },
      quality_deps: {
        // ok → ready；degraded/down → partial（不造数，只暴露组件健康）
        status: health.status === 'ok' ? 'ready' : 'partial',
        metrics: health.components.map((c) => ({
          key: c.name,
          status: c.status === 'ok' ? ('ready' as const) : ('partial' as const),
          value: c.latencyMs,
          unit: 'ms',
          note: c.status,
        })),
        note: '一期不伪造检索瀑布；依赖健康见组件状态',
      },
    }

    return {
      window,
      generatedAt: new Date().toISOString(),
      kpis,
      sections,
    }
  }

  async getCompanionDetail(window: ObservabilityWindow = '24h'): Promise<ObservabilityDetail> {
    const since = windowStart(window)
    // 单次 metadata 扫描同时服务 KPI + emotion，避免详页二次全量扫
    const [metaAgg, feedback, hardStop, userMsgCount] = await Promise.all([
      this.scanCompanionAssistantMetadata(since),
      this.aggregateFeedback(since),
      this.aggregateHardStops(since),
      this.prisma.companionMessage.count({
        where: { role: 'user', createdAt: { gte: since } },
      }),
    ])
    const companion = this.composeHubCompanion(metaAgg, feedback, hardStop, userMsgCount)

    const kpis: Kpi[] = [
      { key: 'p95LatencyMs', label: '端到端 P95', ...companion.p95LatencyMs },
      {
        key: 'qualityFailRate',
        label: 'Quality fail 率（观测型）',
        ...companion.qualityFailRate,
        note: companion.qualityFailRate.note ?? '观测型：不表示主回复被丢弃',
      },
      { key: 'safetyHardStopRate', label: '安全硬中断率', ...companion.safetyHardStopRate },
      { key: 'negativeFeedbackRate', label: '负反馈率', ...companion.negativeFeedbackRate },
    ]

    const sections: Record<string, ObservabilitySection> = {
      latency: {
        status: this.kpiToSectionStatus(companion.p95LatencyMs),
        metrics: [
          {
            key: 'p95_latency_ms',
            status: companion.p95LatencyMs.status,
            value: companion.p95LatencyMs.value,
            unit: 'ms',
          },
        ],
      },
      retrieval: {
        status: 'pending_instrumentation',
        metrics: [],
        note: 'Companion 主路径一期未接知识检索，不伪造检索质量',
      },
      emotion: this.composeEmotionSection(metaAgg),
      cost_safety: {
        status: this.composeCostSafetySectionStatus(companion),
        metrics: [
          {
            key: 'token_cost',
            status: 'pending_instrumentation',
            note: '一期无 token 成本埋点',
          },
          {
            key: 'quality_fail_rate',
            status: companion.qualityFailRate.status,
            value: companion.qualityFailRate.value,
            unit: 'ratio',
            note: '观测型',
          },
          {
            key: 'safety_hard_stop_rate',
            status: companion.safetyHardStopRate.status,
            value: companion.safetyHardStopRate.value,
            unit: 'ratio',
            note: '硬中断不出现在聊天记录，来自侧信道事件',
          },
          {
            key: 'negative_feedback_rate',
            status: companion.negativeFeedbackRate.status,
            value: companion.negativeFeedbackRate.value,
            unit: 'ratio',
            note: 'negative / feedbackCount',
          },
        ],
      },
    }

    return {
      window,
      generatedAt: new Date().toISOString(),
      kpis,
      sections,
    }
  }

  // ── health ──────────────────────────────────────────────

  private async buildHealth(): Promise<HubHealth> {
    const core = await this.healthService.check()
    const ka = await this.probeKnowledgeAi()
    const components = [
      ...core.components.map((c) => ({
        name: c.name,
        status: c.status,
        latencyMs: c.latencyMs,
      })),
      ka,
    ]

    const hasDown = components.some((c) => c.status === 'down' && c.name !== 'knowledge-ai')
    const kaDown = ka.status === 'down' || ka.status === 'degraded'
    // 关键依赖 down → down；仅 KA 不可达/降级 → degraded
    let status: HubHealth['status'] = 'ok'
    if (hasDown || core.status === 'down') {
      status = 'down'
    } else if (core.status === 'degraded' || kaDown) {
      status = 'degraded'
    }

    const withLatency = components.filter(
      (c): c is { name: string; status: HubHealth['status']; latencyMs: number } =>
        typeof c.latencyMs === 'number',
    )
    const slowest =
      withLatency.length > 0
        ? withLatency.reduce((a, b) => (a.latencyMs >= b.latencyMs ? a : b))
        : undefined

    return {
      status,
      components,
      slowest: slowest ? { name: slowest.name, latencyMs: slowest.latencyMs } : undefined,
    }
  }

  private async probeKnowledgeAi(): Promise<{
    name: string
    status: 'ok' | 'degraded' | 'down'
    latencyMs: number
  }> {
    const start = Date.now()
    try {
      const raw = (await this.knowledgeAi.health()) as { status?: string }
      const latencyMs = Date.now() - start
      const st = raw?.status
      if (st === 'ok') return { name: 'knowledge-ai', status: 'ok', latencyMs }
      if (st === 'degraded') return { name: 'knowledge-ai', status: 'degraded', latencyMs }
      // unavailable or unknown
      return { name: 'knowledge-ai', status: 'degraded', latencyMs }
    } catch (err) {
      this.logger.warn(
        `Knowledge AI health probe failed: ${err instanceof Error ? err.message : String(err)}`,
      )
      return { name: 'knowledge-ai', status: 'down', latencyMs: Date.now() - start }
    }
  }

  // ── inventory ───────────────────────────────────────────

  private async buildInventory() {
    const [userCount, knowledgeBaseCount, documentCount, companionCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.knowledgeBase.count(),
      this.prisma.document.count(),
      this.prisma.companion.count(),
    ])
    return { userCount, knowledgeBaseCount, documentCount, companionCount }
  }

  // ── RAG hub ─────────────────────────────────────────────

  private async buildHubRag(since: Date) {
    const indexFailureCount = await this.prisma.document.count({
      where: {
        status: 'failed',
        updatedAt: { gte: since },
      },
    })

    const chatAgg = await this.scanChatAssistantMetadata(since)

    return {
      emptyRate: buildRateKpi({
        numerator: chatAgg.emptyCount,
        denominator: chatAgg.total,
        instrumented: true,
        partial: chatAgg.partial,
        note: chatAgg.partial ? '样本达扫描上限，结果为 partial' : undefined,
      }),
      degradedRate: buildRateKpi({
        numerator: chatAgg.degradedCount,
        denominator: chatAgg.total,
        instrumented: chatAgg.degradedInstrumented,
        partial: chatAgg.partial,
        note: chatAgg.degradedInstrumented
          ? chatAgg.partial
            ? '样本达扫描上限，结果为 partial'
            : undefined
          : 'Chat metadata.degraded 尚未出现样本（管线写入后自动 ready）',
      }),
      indexFailureCount: buildCountKpi(indexFailureCount),
    }
  }

  private async scanChatAssistantMetadata(since: Date): Promise<{
    total: number
    emptyCount: number
    degradedCount: number
    degradedInstrumented: boolean
    partial: boolean
  }> {
    type ScanResult = {
      total: number
      emptyCount: number
      degradedCount: number
      degradedInstrumented: boolean
      partial: boolean
    }
    return this.withTimeout<ScanResult>(
      async () => {
        const rows = await this.prisma.message.findMany({
          where: {
            role: 'assistant',
            createdAt: { gte: since },
            status: 'completed',
          },
          select: { metadata: true },
          orderBy: { createdAt: 'desc' },
          take: this.scanLimit,
        })

        // 是否窗内还有更多（partial）
        const totalInWindow = await this.prisma.message.count({
          where: {
            role: 'assistant',
            createdAt: { gte: since },
            status: 'completed',
          },
        })

        let emptyCount = 0
        let degradedCount = 0

        for (const row of rows) {
          const meta = parseJsonObject(row.metadata)
          if (isTruthyFlag(meta, 'retrieval_empty')) emptyCount += 1
          if (isTruthyFlag(meta, 'degraded')) degradedCount += 1
        }

        return {
          total: rows.length,
          emptyCount,
          degradedCount,
          // Chat 定稿路径已支持 metadata.degraded；有样本即可按 ready/insufficient 评估
          degradedInstrumented: true,
          partial: totalInWindow > rows.length,
        }
      },
      {
        total: 0,
        emptyCount: 0,
        degradedCount: 0,
        degradedInstrumented: false,
        partial: true,
      },
    )
  }

  // ── Companion hub ───────────────────────────────────────

  private async buildHubCompanion(since: Date) {
    const [metaAgg, feedback, hardStop, userMsgCount] = await Promise.all([
      this.scanCompanionAssistantMetadata(since),
      this.aggregateFeedback(since),
      this.aggregateHardStops(since),
      this.prisma.companionMessage.count({
        where: {
          role: 'user',
          createdAt: { gte: since },
        },
      }),
    ])
    return this.composeHubCompanion(metaAgg, feedback, hardStop, userMsgCount)
  }

  private composeHubCompanion(
    metaAgg: CompanionMetaAgg,
    feedback: { negative: number; total: number },
    hardStop: { count: number; instrumented: boolean },
    userMsgCount: number,
  ) {
    return {
      p95LatencyMs: buildP95Kpi(
        metaAgg.latencies,
        metaAgg.latencyInstrumented,
        metaAgg.partial,
      ),
      qualityFailRate: buildRateKpi({
        numerator: metaAgg.qualityFailCount,
        denominator: metaAgg.qualitySampleCount,
        instrumented: true,
        partial: metaAgg.partial,
        note: '观测型 quality.status=fail，不表示主回复被丢弃',
      }),
      safetyHardStopRate: buildRateKpi({
        numerator: hardStop.count,
        denominator: userMsgCount,
        instrumented: hardStop.instrumented,
        note: hardStop.instrumented
          ? 'hard_stop / companion_user_messages；硬中断不出现在聊天记录'
          : '侧信道 companion_obs_event 未就绪',
      }),
      negativeFeedbackRate: buildRateKpi({
        numerator: feedback.negative,
        denominator: feedback.total,
        instrumented: true,
        note: 'negative / feedbackCount',
      }),
    }
  }

  private composeEmotionSection(metaAgg: CompanionMetaAgg): ObservabilitySection {
    if (metaAgg.partial && metaAgg.emotionSampleCount === 0) {
      return {
        status: 'partial',
        metrics: [],
        note: '情绪聚合超时或扫描未完成',
      }
    }
    if (metaAgg.emotionSampleCount === 0) {
      return {
        status: 'pending_instrumentation',
        metrics: [],
        note: '尚无 emotion 元数据样本',
      }
    }

    const metrics = Object.entries(metaAgg.emotionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([key, value]) => ({
        key,
        status: 'ready' as const,
        value,
        unit: 'count',
      }))

    return {
      status: metaAgg.partial ? 'partial' : 'ready',
      metrics,
      note: `基于 ${metaAgg.emotionSampleCount} 条含 emotion 的助手消息`,
    }
  }

  private kpiToSectionStatus(kpi: Kpi): ObservabilitySection['status'] {
    if (kpi.status === 'pending_instrumentation') return 'pending_instrumentation'
    if (kpi.status === 'ready' && kpi.partial) return 'partial'
    return 'ready'
  }

  private composeCostSafetySectionStatus(companion: {
    safetyHardStopRate: Kpi
    qualityFailRate: Kpi
  }): ObservabilitySection['status'] {
    const bothPending =
      companion.safetyHardStopRate.status === 'pending_instrumentation' &&
      companion.qualityFailRate.status === 'pending_instrumentation'
    if (bothPending) return 'pending_instrumentation'
    const partial =
      companion.safetyHardStopRate.partial || companion.qualityFailRate.partial
    return partial ? 'partial' : 'ready'
  }

  private async scanCompanionAssistantMetadata(since: Date): Promise<CompanionMetaAgg> {
    const empty: CompanionMetaAgg = {
      latencies: [],
      latencyInstrumented: false,
      qualityFailCount: 0,
      qualitySampleCount: 0,
      partial: true,
      emotionCounts: {},
      emotionSampleCount: 0,
    }
    return this.withTimeout<CompanionMetaAgg>(async () => {
      const rows = await this.prisma.companionMessage.findMany({
        where: {
          role: 'assistant',
          createdAt: { gte: since },
        },
        select: { metadata: true },
        orderBy: { createdAt: 'desc' },
        take: this.scanLimit,
      })

      const totalInWindow = await this.prisma.companionMessage.count({
        where: {
          role: 'assistant',
          createdAt: { gte: since },
        },
      })

      const latencies: number[] = []
      let qualityFailCount = 0
      let qualitySampleCount = 0
      const emotionCounts: Record<string, number> = {}
      let emotionSampleCount = 0

      for (const row of rows) {
        const meta = parseJsonObject(row.metadata)
        const lat = readNumberField(meta, 'latencyMs')
        if (lat != null) {
          latencies.push(lat)
        }
        if (hasQualitySnapshot(meta)) {
          qualitySampleCount += 1
          if (qualityIsFail(meta)) qualityFailCount += 1
        }
        const emotion = meta?.emotion
        if (emotion && typeof emotion === 'object' && !Array.isArray(emotion)) {
          const primary = (emotion as { primaryEmotion?: string }).primaryEmotion
          if (primary) {
            emotionSampleCount += 1
            emotionCounts[primary] = (emotionCounts[primary] ?? 0) + 1
          }
        }
      }

      return {
        latencies,
        // 助手定稿路径已写入 latencyMs；历史无字段的样本不计入 latencies
        latencyInstrumented: true,
        qualityFailCount,
        qualitySampleCount,
        partial: totalInWindow > rows.length,
        emotionCounts,
        emotionSampleCount,
      }
    }, empty)
  }

  private async aggregateFeedback(since: Date): Promise<{ negative: number; total: number }> {
    const [total, negative] = await Promise.all([
      this.prisma.companionMessageFeedback.count({
        where: { createdAt: { gte: since } },
      }),
      this.prisma.companionMessageFeedback.count({
        where: { createdAt: { gte: since }, rating: 'negative' },
      }),
    ])
    return { negative, total }
  }

  private async aggregateHardStops(
    since: Date,
  ): Promise<{ count: number; instrumented: boolean }> {
    try {
      // 表存在即可 instrumented（即便 count=0）
      const count = await this.prisma.companionObsEvent.count({
        where: {
          type: COMPANION_OBS_SAFETY_HARD_STOP,
          createdAt: { gte: since },
        },
      })
      return { count, instrumented: true }
    } catch (err) {
      this.logger.warn(
        `companion_obs_event unavailable: ${err instanceof Error ? err.message : String(err)}`,
      )
      return { count: 0, instrumented: false }
    }
  }

  private async withTimeout<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await Promise.race([
        fn(),
        new Promise<T>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`metadata scan timed out after ${SCAN_TIMEOUT_MS}ms`)),
            SCAN_TIMEOUT_MS,
          )
        }),
      ])
      return result
    } catch (err) {
      this.logger.warn(
        `metadata aggregation degraded: ${err instanceof Error ? err.message : String(err)}`,
      )
      return fallback
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}

