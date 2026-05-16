import { Client as MinioClient } from 'minio'
import type {
  IStorageProvider,
  StorageMeta,
  StorageUrlOptions,
} from '../interfaces/IStorageProvider.js'
import { StorageError, NotFoundError, ValidationError } from '../interfaces/errors.js'
import type { MinIOConfig } from '../config/storage.js'

export interface IMinIOStorageProvider extends IStorageProvider {
  initialize(): Promise<void>
  getPresignedUploadUrl(key: string, expiry?: number): Promise<string>
}

export class MinIOStorageProvider implements IMinIOStorageProvider {
  private client: MinioClient
  private bucket: string
  private endpoint: string

  constructor(config: MinIOConfig) {
    this.client = new MinioClient({
      endPoint: config.endpoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      region: config.region,
    })
    this.bucket = config.bucket
    this.endpoint = `${config.useSSL ? 'https' : 'http'}://${config.endpoint}${config.port ? ':' + config.port : ''}`
  }

  async initialize(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket)
      if (!exists) {
        await this.client.makeBucket(this.bucket)
        console.info(`[storage] bucket '${this.bucket}' 创建成功`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('AccessDenied') || message.includes('InvalidAccessKeyId')) {
        throw new StorageError(
          `MinIO 访问被拒绝，请检查 AccessKey / SecretKey（endpoint: ${this.endpoint}）`,
          err
        )
      }
      if (message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT')) {
        throw new StorageError(
          `无法连接到 MinIO（endpoint: ${this.endpoint}），请检查服务是否运行`,
          err
        )
      }
      throw new StorageError(`初始化 MinIO 失败：${message}`, err)
    }
  }

  private validateKey(key: string): void {
    if (!key || !key.startsWith('users/') || !key.includes('/kb/')) {
      throw new ValidationError('storage key 不能为空或格式错误，期望格式：users/<user-id>/kb/<kb-id>/<doc-id>_<filename>')
    }
  }

  private extractOriginalName(key: string): string {
    const lastSlash = key.lastIndexOf('/')
    return lastSlash >= 0 ? key.slice(lastSlash + 1) : key
  }

  async upload(
    key: string,
    stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream,
    contentType: string
  ): Promise<StorageMeta> {
    this.validateKey(key)
    if (!stream) {
      throw new ValidationError('上传流不能为空')
    }

    const meta: Record<string, string> = {
      'X-Amz-Meta-Original-Name': this.extractOriginalName(key),
      'X-Amz-Meta-Content-Type': contentType,
      'X-Amz-Meta-Upload-Time': new Date().toISOString(),
    }

    try {
      // MinIO Node.js SDK 接受 NodeJS.ReadableStream；若传入 Web ReadableStream，需转换
      const nodeStream = await this.toNodeStream(stream)
      const result = await this.client.putObject(this.bucket, key, nodeStream as any, undefined, meta)
      const etag = result.etag
      const size = 0

      console.info(`[storage] 上传成功 key=${key} size=${size}`)

      return {
        key,
        size,
        etag,
        contentType,
        lastModified: new Date(),
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('NoSuchBucket')) {
        throw new StorageError(`上传失败：bucket '${this.bucket}' 不存在`, err)
      }
      if (message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT')) {
        throw new StorageError(`上传失败：无法连接到 MinIO (${this.endpoint})`, err)
      }
      if (message.includes('AccessDenied')) {
        throw new StorageError('上传失败：访问被拒绝，请检查 MinIO 凭据', err)
      }
      throw new StorageError(`上传失败：${message}`, err)
    }
  }

  private async toNodeStream(
    stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream
  ): Promise<NodeJS.ReadableStream> {
    if (typeof (stream as ReadableStream<Uint8Array>).getReader === 'function') {
      const webStream = stream as ReadableStream<Uint8Array>
      const reader = webStream.getReader()
      const { Readable } = await import('stream')
      return new Readable({
        async read() {
          try {
            const { done, value } = await reader.read()
            if (done) {
              this.push(null)
            } else {
              this.push(Buffer.from(value))
            }
          } catch (err) {
            this.destroy(err instanceof Error ? err : new Error(String(err)))
          }
        },
      })
    }
    return stream as NodeJS.ReadableStream
  }

  async download(key: string): Promise<ReadableStream<Uint8Array>> {
    this.validateKey(key)

    try {
      const nodeStream = await this.client.getObject(this.bucket, key)

      return new ReadableStream<Uint8Array>({
        start(controller) {
          nodeStream.on('data', (chunk: Buffer) => {
            controller.enqueue(new Uint8Array(chunk))
          })
          nodeStream.on('end', () => controller.close())
          nodeStream.on('error', (err: Error) => controller.error(err))
        },
        cancel() {
          nodeStream.destroy()
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('NoSuchKey')) {
        throw new NotFoundError('文件', key)
      }
      if (message.includes('NoSuchBucket')) {
        throw new StorageError(`下载失败：bucket '${this.bucket}' 不存在`, err)
      }
      if (message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT')) {
        throw new StorageError('下载失败：无法连接到 MinIO', err)
      }
      throw new StorageError(`下载失败：${message}`, err)
    }
  }

  async delete(key: string): Promise<void> {
    this.validateKey(key)

    try {
      await this.client.removeObject(this.bucket, key)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT')) {
        throw new StorageError('删除失败：无法连接到 MinIO', err)
      }
      if (message.includes('AccessDenied')) {
        throw new StorageError('删除失败：访问被拒绝', err)
      }
      // removeObject 对不存在的 key 通常静默成功；若出现其他错误，继续包装
      if (!message.includes('NoSuchKey')) {
        throw new StorageError(`删除失败：${message}`, err)
      }
    }
  }

  async getUrl(key: string, _options?: StorageUrlOptions): Promise<string> {
    this.validateKey(key)

    try {
      await this.client.statObject(this.bucket, key)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('NoSuchKey')) {
        throw new NotFoundError('文件', key)
      }
      if (message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT')) {
        throw new StorageError('获取 URL 失败：无法连接到 MinIO', err)
      }
      throw new StorageError(`获取 URL 失败：${message}`, err)
    }

    return `${this.endpoint}/${this.bucket}/${encodeURIComponent(key)}`
  }

  async getPresignedUploadUrl(key: string, _expiry = 3600): Promise<string> {
    this.validateKey(key)
    throw new StorageError('预签名 URL 尚未实现（Phase 6）')
  }
}
