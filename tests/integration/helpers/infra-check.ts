import net from 'net'
import { Client } from 'pg'

export interface InfraHealthResult {
  postgres: boolean
  pgvector: boolean
  redis: boolean
  minio: boolean
  allAvailable: boolean
  details: {
    postgres?: string
    pgvector?: string
    redis?: string
    minio?: string
  }
}

function checkTcpPort(host: string, port: number, timeout = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(timeout)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => {
      socket.destroy()
      resolve(false)
    })
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.connect(port, host)
  })
}

export async function checkInfrastructure(): Promise<InfraHealthResult> {
  const result: InfraHealthResult = {
    postgres: false,
    pgvector: false,
    redis: false,
    minio: false,
    allAvailable: false,
    details: {},
  }

  // 1. PostgreSQL
  const pgHost = process.env.PGHOST || 'localhost'
  const pgPort = parseInt(process.env.PGPORT || '5432', 10)
  try {
    result.postgres = await checkTcpPort(pgHost, pgPort)
    if (!result.postgres) {
      result.details.postgres = `PostgreSQL TCP port ${pgHost}:${pgPort} unreachable`
    }
  } catch (err) {
    result.details.postgres = err instanceof Error ? err.message : String(err)
  }

  // 2. pgvector 扩展（通过 PostgreSQL 查询检测）
  if (result.postgres) {
    const adminUrl = process.env.TEST_DATABASE_ADMIN_URL || process.env.DATABASE_URL
    if (adminUrl) {
      const client = new Client({ connectionString: adminUrl })
      try {
        await client.connect()
        const res = await client.query("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
        result.pgvector = res.rowCount !== null && res.rowCount > 0
        if (!result.pgvector) {
          result.details.pgvector = 'pgvector extension not installed in PostgreSQL'
        }
      } catch (err) {
        result.details.pgvector = err instanceof Error ? err.message : String(err)
      } finally {
        await client.end().catch(() => {})
      }
    } else {
      result.details.pgvector = 'DATABASE_URL or TEST_DATABASE_ADMIN_URL not set'
    }
  } else {
    result.details.pgvector = 'PostgreSQL unavailable, skipping pgvector check'
  }

  // 3. Redis
  const redisHost = process.env.REDIS_HOST || 'localhost'
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10)
  try {
    result.redis = await checkTcpPort(redisHost, redisPort)
    if (!result.redis) {
      result.details.redis = `Redis TCP port ${redisHost}:${redisPort} unreachable`
    }
  } catch (err) {
    result.details.redis = err instanceof Error ? err.message : String(err)
  }

  // 4. MinIO
  const minioHost = process.env.MINIO_HOST || 'localhost'
  const minioPort = parseInt(process.env.MINIO_PORT || '9000', 10)
  try {
    result.minio = await checkTcpPort(minioHost, minioPort)
    if (!result.minio) {
      result.details.minio = `MinIO TCP port ${minioHost}:${minioPort} unreachable`
    }
  } catch (err) {
    result.details.minio = err instanceof Error ? err.message : String(err)
  }

  result.allAvailable = result.postgres && result.pgvector && result.redis && result.minio
  return result
}

export function formatInfraSkipReason(result: InfraHealthResult): string {
  const failed = Object.entries(result.details)
    .filter(([key]) => !result[key as keyof InfraHealthResult])
    .map(([key, msg]) => `  - ${key}: ${msg}`)
    .join('\n')
  return `基础设施不可用，跳过真实集成测试：\n${failed}`
}
