import type { NotFoundError, StorageError } from './errors.js'

/** 存储对象元数据 */
export interface StorageMeta {
  /** 存储键 */
  key: string
  /** 文件大小（字节） */
  size: number
  /** ETag */
  etag?: string
  /** MIME 类型 */
  contentType: string
  /** 最后修改时间 */
  lastModified?: Date
}

/** 获取 URL 的选项 */
export interface StorageUrlOptions {
  /** 预签名 URL 过期时间（秒），默认 3600 */
  expiresIn?: number
}

/**
 * 文件存储抽象，屏蔽本地文件系统与 MinIO 对象存储的差异。
 */
export interface IStorageProvider {
  /**
   * 上传文件流到存储后端。
   * @param key — 存储键，格式遵循 PRD: `users/<user-id>/kb/<kb-id>/<doc-id>_<filename>`
   * @param stream — 文件可读流
   * @param contentType — MIME 类型（如 "application/pdf"）
   * @returns 存储元数据（含 key、size、etag 等）
   * @throws StorageError — 上传失败（网络中断、bucket 不存在等）
   */
  upload(
    key: string,
    stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream,
    contentType: string
  ): Promise<StorageMeta>

  /**
   * 下载文件为可读流。
   * @param key — 存储键
   * @returns 文件可读流
   * @throws NotFoundError — 文件不存在时抛出
   * @throws StorageError — 存储层异常
   */
  download(key: string): Promise<ReadableStream<Uint8Array>>

  /**
   * 删除文件。
   * @param key — 存储键
   * @returns void
   * @throws NotFoundError — 文件不存在时抛出（实现也可选择静默成功）
   */
  delete(key: string): Promise<void>

  /**
   * 获取文件访问 URL。
   * @param key — 存储键
   * @param options — 可选配置（如预签名 URL 过期时间）
   * @returns 可直接访问的 URL 字符串
   * @throws NotFoundError — 文件不存在时抛出
   */
  getUrl(key: string, options?: StorageUrlOptions): Promise<string>
}
