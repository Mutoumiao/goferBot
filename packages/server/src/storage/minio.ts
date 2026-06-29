import * as Minio from 'minio'

export interface MinIOConfig {
  endPoint: string
  port: number
  useSSL: boolean
  accessKey: string
  secretKey: string
  bucket: string
  region?: string
}

export class MinIOStorageProvider {
  private client: Minio.Client
  private bucket: string
  private endpointUrl: string

  constructor(config: MinIOConfig) {
    this.client = new Minio.Client({
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      region: config.region || 'us-east-1',
    })
    this.bucket = config.bucket
    const protocol = config.useSSL ? 'https:' : 'http:'
    this.endpointUrl = `${protocol}//${config.endPoint}:${config.port}`
  }

  async initialize(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket)
    if (!exists) {
      await this.client.makeBucket(this.bucket, this.client.region || 'us-east-1')
    }
  }

  /** 健康检查：验证 bucket 可达 */
  async bucketExists(): Promise<boolean> {
    return this.client.bucketExists(this.bucket)
  }

  async uploadFile(buffer: Buffer, key: string, mimeType: string): Promise<string> {
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': mimeType,
    })
    return key
  }

  async downloadFile(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key)
    const chunks: Buffer[] = []
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('end', () => resolve(Buffer.concat(chunks)))
      stream.on('error', reject)
    })
  }

  async deleteFile(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key)
  }

  getUrl(key: string): string {
    return `${this.endpointUrl}/${this.bucket}/${key}`
  }

  extractKeyFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url)
      // MinIO URL 格式：{endpoint}/{bucket}/{key}
      const parts = parsed.pathname.split('/').filter(Boolean)
      if (parts.length >= 2 && parts[0] === this.bucket) {
        return parts.slice(1).join('/')
      }
      return null
    } catch {
      return null
    }
  }

  async getPresignedUploadUrl(key: string, expiry: number = 3600): Promise<string> {
    return this.client.presignedPutObject(this.bucket, key, expiry)
  }
}
