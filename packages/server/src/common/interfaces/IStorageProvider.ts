export interface IStorageProvider {
  /**
   * 上传文件到对象存储。
   * @param buffer — 文件二进制数据
   * @param key — 存储键（唯一标识）
   * @param mimeType — MIME 类型
   * @returns 存储键
   */
  uploadFile(buffer: Buffer, key: string, mimeType: string): Promise<string>

  /**
   * 下载文件。
   * @param key — 存储键
   * @returns 文件二进制数据
   */
  downloadFile(key: string): Promise<Buffer>

  /**
   * 删除文件。
   * @param key — 存储键
   */
  deleteFile(key: string): Promise<void>

  /**
   * 获取文件访问 URL。
   * @param key — 存储键
   * @returns 公开访问 URL
   */
  getUrl(key: string): string

  /**
   * 从公开访问 URL 中提取存储键。
   * @param url — 公开访问 URL
   * @returns 存储键，解析失败返回 null
   */
  extractKeyFromUrl(url: string): string | null

  /**
   * 获取预签名上传 URL（预留）。
   * @param key — 存储键
   * @param expiry — 过期时间（秒）
   * @returns 预签名 URL
   */
  getPresignedUploadUrl(key: string, expiry?: number): Promise<string>
}
