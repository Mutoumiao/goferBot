import { StorageError } from '../interfaces/errors.js'

export interface MinIOConfig {
  /** MinIO 服务端点主机名，如 localhost */
  endpoint: string
  /** 端口号（如 9000），可选 */
  port?: number
  /** Access Key */
  accessKey: string
  /** Secret Key */
  secretKey: string
  /** Bucket 名称，默认 goferbot-files */
  bucket: string
  /** Region，默认 us-east-1 */
  region: string
  /** 是否使用 SSL（根据 endpoint 协议自动推断） */
  useSSL: boolean
}

export function getStorageConfig(): MinIOConfig {
  const endpoint = process.env.MINIO_ENDPOINT ?? 'http://localhost:9000'
  const accessKey = process.env.MINIO_ACCESS_KEY
  const secretKey = process.env.MINIO_SECRET_KEY
  const bucket = process.env.MINIO_BUCKET ?? 'goferbot-files'
  const region = process.env.MINIO_REGION ?? 'us-east-1'

  if (!accessKey) {
    throw new StorageError('环境变量 MINIO_ACCESS_KEY 未设置')
  }
  if (!secretKey) {
    throw new StorageError('环境变量 MINIO_SECRET_KEY 未设置')
  }

  const useSSL = endpoint.startsWith('https://')
  const cleanEndpoint = endpoint.replace(/^https?:\/\//, '').replace(/:\d+$/, '')
  const portMatch = endpoint.match(/:(\d+)$/)
  const port = portMatch ? parseInt(portMatch[1], 10) : undefined

  return {
    endpoint: cleanEndpoint,
    port,
    accessKey,
    secretKey,
    bucket,
    region,
    useSSL,
  }
}
