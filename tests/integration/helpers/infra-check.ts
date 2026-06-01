import net from 'net'

export interface InfraHealthResult {
  postgres: boolean
  milvus: boolean
  redis: boolean
  minio: boolean
  allAvailable: boolean
  details: {
    postgres?: string
    milvus?: string
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
    milvus: false,
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

  // 2. Milvus
  const milvusHost = process.env.MILVUS_HOST || 'localhost'
  const milvusPort = parseInt(process.env.MILVUS_PORT || '19530', 10)
  try {
    result.milvus = await checkTcpPort(milvusHost, milvusPort)
    if (!result.milvus) {
      result.details.milvus = `Milvus TCP port ${milvusHost}:${milvusPort} unreachable`
    }
  } catch (err) {
    result.details.milvus = err instanceof Error ? err.message : String(err)
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

  result.allAvailable = result.postgres && result.milvus && result.redis && result.minio
  return result
}

export function formatInfraSkipReason(result: InfraHealthResult): string {
  const failed = Object.entries(result.details)
    .filter(([key]) => !result[key as keyof InfraHealthResult])
    .map(([key, msg]) => `  - ${key}: ${msg}`)
    .join('\n')
  return `基础设施不可用，跳过真实集成测试：\n${failed}`
}
