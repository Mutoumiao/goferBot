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
  }

  async initialize(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket)
    if (!exists) {
      await this.client.makeBucket(this.bucket, this.client.region || 'us-east-1')
    }
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
    // 返回 MinIO 直链（开发环境）
    // 使用内部状态避免访问 protected 属性
    const protocol = (this.client as unknown as { protocol: string }).protocol
    const host = (this.client as unknown as { host: string }).host
    const port = (this.client as unknown as { port: number }).port
    return `${protocol}//${host}:${port}/${this.bucket}/${key}`
  }

  async getPresignedUploadUrl(key: string, expiry: number = 3600): Promise<string> {
    return this.client.presignedPutObject(this.bucket, key, expiry)
  }
}
