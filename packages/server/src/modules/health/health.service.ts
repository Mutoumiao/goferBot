import { Inject, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { AuthRedisService } from '../../auth/auth-redis.service.js'
import { STORAGE_PROVIDER } from '../../processors/storage/storage.provider.js'
import type { MinIOStorageProvider } from '../../storage/minio.js'

export type HealthStatus = 'ok' | 'degraded' | 'down'

export interface HealthComponent {
  name: string
  status: HealthStatus
  latencyMs: number
  error?: string
}

export interface HealthSnapshot {
  status: HealthStatus
  timestamp: string
  version: string
  components: HealthComponent[]
}

const PROBE_TIMEOUT_MS = 2500

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly authRedis: AuthRedisService,
    @Inject(STORAGE_PROVIDER) private readonly storage: MinIOStorageProvider,
  ) {}

  async check(): Promise<HealthSnapshot> {
    const components = await Promise.all([
      this.probe('postgres', async () => { await this.prisma.$queryRaw`SELECT 1` }),
      this.probe('redis', () => this.authRedis.ping()),
      this.probe('minio', () => this.storage.bucketExists()),
    ])

    const hasDown = components.some((c) => c.status === 'down')
    const hasDegraded = components.some((c) => c.status === 'degraded')

    const status: HealthStatus = hasDown ? 'down' : hasDegraded ? 'degraded' : 'ok'

    return {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.1.0',
      components: components.map(({ error: _omit, ...rest }) => rest),
    }
  }

  private async probe(
    name: string,
    fn: () => Promise<unknown>,
  ): Promise<HealthComponent> {
    const start = Date.now()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`probe timed out after ${PROBE_TIMEOUT_MS}ms`)),
            PROBE_TIMEOUT_MS,
          )
        }),
      ])
      if (result === 'skipped') {
        return { name, status: 'degraded', latencyMs: Date.now() - start }
      }
      return { name, status: 'ok', latencyMs: Date.now() - start }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const isTimeout = message.startsWith('probe timed out')
      const status: HealthStatus = isTimeout ? 'degraded' : 'down'
      this.logger.warn(`Health probe "${name}" failed: ${message}`)
      return { name, status, latencyMs: Date.now() - start, error: message }
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}
