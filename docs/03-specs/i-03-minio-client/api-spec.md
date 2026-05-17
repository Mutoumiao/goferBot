---
issue_id: i-03-minio-client
type: api-spec
status: approved
summary: 内部 TypeScript 接口（无 REST 端点）：MinIOStorageProvider 实现 IStorageProvider，提供 upload/ download/ delete/ getUrl 方法签名、StorageMeta 类型与 StorageError 错误定义。
---
# API Spec: i-03-minio-client

## 说明

本 feature 为**基础设施层内部服务接口**，不直接暴露为 REST API 端点。业务层（Hono Router / Service）通过依赖注入使用 `IStorageProvider` 接口与 MinIO 交互。

因此，本文档仅定义**内部 TypeScript 接口契约**与**调用约定**，无 HTTP 路由定义。

## 1. 接口定义

### 1.1 IStorageProvider（已有，i-00-core-interfaces 定义）

```ts
export interface IStorageProvider {
  upload(
    key: string,
    stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream,
    contentType: string
  ): Promise<StorageMeta>

  download(key: string): Promise<ReadableStream<Uint8Array>>

  delete(key: string): Promise<void>

  getUrl(key: string, options?: StorageUrlOptions): Promise<string>
}
```

### 1.2 扩展接口（本 feature 新增）

MinIO 实现类在 `IStorageProvider` 基础上，额外暴露以下方法：

```ts
export interface IMinIOStorageProvider extends IStorageProvider {
  /**
   * 初始化：检查并创建 bucket。
   * 由应用启动脚本显式调用一次。
   */
  initialize(): Promise<void>

  /**
   * 获取预签名上传 URL（Phase 6 完善）。
   * @param key — 存储键
   * @param expiry — 过期时间（秒），默认 3600
   * @returns 预签名 URL 字符串
   * @throws StorageError — 生成失败或功能未实现
   */
  getPresignedUploadUrl(key: string, expiry?: number): Promise<string>
}
```

## 2. 数据类型

### 2.1 StorageMeta

```ts
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
```

### 2.2 StorageUrlOptions

```ts
export interface StorageUrlOptions {
  /** 预签名 URL 过期时间（秒），默认 3600 */
  expiresIn?: number
}
```

## 3. 配置接口

### 3.1 MinIOConfig

```ts
export interface MinIOConfig {
  /** MinIO 服务端点，如 http://localhost:9000 */
  endpoint: string
  /** Access Key */
  accessKey: string
  /** Secret Key */
  secretKey: string
  /** Bucket 名称，默认 goferbot-files */
  bucket: string
  /** Region，默认 us-east-1 */
  region?: string
  /** 是否使用 SSL（根据 endpoint 协议自动推断） */
  useSSL?: boolean
}
```

## 4. 调用约定

### 4.1 实例化与注入

```ts
import { MinIOStorageProvider } from '@/storage/minio'
import { getStorageConfig } from '@/config/storage'

const config = getStorageConfig() // 从环境变量读取
const storage = new MinIOStorageProvider(config)
await storage.initialize() // 启动时调用

// 注入到 Service 层
const documentService = new DocumentService(storage)
```

### 4.2 上传示例

```ts
const key = `users/${userId}/kb/${kbId}/${docId}_${filename}`
const meta = await storage.upload(key, fileStream, 'application/pdf')
// meta.key / meta.size / meta.etag 回写至 documents 表
```

### 4.3 下载示例

```ts
const stream = await storage.download(doc.storageKey)
// 将 stream 通过 Hono c.body(stream, 200, { 'Content-Type': doc.mimeType }) 返回客户端
```

### 4.4 删除示例

```ts
await storage.delete(doc.storageKey)
// 上层随后执行 DELETE FROM documents WHERE id = doc.id
```

## 5. 无外部 REST API

本层不暴露任何 HTTP 端点。与外部客户端的交互通过以下 Hono Router 间接完成：

| 业务端点 | 所在模块 | 说明 |
|----------|----------|------|
| `POST /knowledge-bases/:id/documents` | 文档模块 | 接收文件 → 调用 `storage.upload` |
| `GET /knowledge-bases/:id/documents/:docId/download` | 文档模块 | 调用 `storage.download` 后返回流 |
| `DELETE /knowledge-bases/:id/documents/:docId` | 文档模块 | 调用 `storage.delete` 后删除 DB 记录 |

## 6. 环境变量清单

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `MINIO_ENDPOINT` | 否 | `http://localhost:9000` | MinIO 服务地址 |
| `MINIO_ACCESS_KEY` | 是 | — | Access Key |
| `MINIO_SECRET_KEY` | 是 | — | Secret Key |
| `MINIO_BUCKET` | 否 | `goferbot-files` | 使用的 bucket 名称 |
| `MINIO_REGION` | 否 | `us-east-1` | Region |
