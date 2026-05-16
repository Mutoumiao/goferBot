# API 规格：MinIO NestJS Service 封装

> 本 feature 为**基础设施层内部服务接口**，不直接暴露为 REST API 端点。业务层（NestJS Controller / Service）通过依赖注入使用 `StorageService` 与 MinIO 交互。
>
> 因此，本文档仅定义**内部 TypeScript 接口契约**、**NestJS 模块配置**与**调用约定**，无 HTTP 路由定义。

---

## 目录

1. [服务接口定义](#1-服务接口定义)
2. [NestJS 模块定义](#2-nestjs-模块定义)
3. [数据类型](#3-数据类型)
4. [配置接口](#4-配置接口)
5. [调用约定](#5-调用约定)
6. [无外部 REST API](#6-无外部-rest-api)
7. [环境变量清单](#7-环境变量清单)

---

## 1. 服务接口定义

### 1.1 IStorageProvider（已有，i-00-core-interfaces 定义）

```typescript
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

### 1.2 StorageService（本 feature 新增）

`StorageService` 为 NestJS Injectable Service，在 `IStorageProvider` 之上提供 Buffer 友好的方法签名，并暴露预签名 URL 预留接口。

```typescript
import { Injectable } from '@nestjs/common'
import type { IStorageProvider, StorageMeta, StorageUrlOptions } from '../interfaces/IStorageProvider.js'

@Injectable()
export class StorageService implements IStorageProvider {
  /**
   * 上传文件（Buffer 友好型接口）。
   * @param buffer — 文件二进制 Buffer（如 Multer 提供的 file.buffer）
   * @param key — 存储键，格式遵循 PRD: `users/<user-id>/kb/<kb-id>/<doc-id>_<filename>`
   * @param mimeType — MIME 类型（如 "application/pdf"）
   * @returns 存储元数据（含 key、size、etag 等）
   * @throws StorageError — 上传失败
   * @throws ValidationError — key 格式非法或 buffer 为空
   */
  uploadFile(buffer: Buffer, key: string, mimeType: string): Promise<StorageMeta>

  /**
   * 下载文件为可读流。
   * @param key — 存储键
   * @returns Web 标准 ReadableStream<Uint8Array>
   * @throws NotFoundError — 文件不存在
   * @throws StorageError — 存储层异常
   */
  downloadFile(key: string): Promise<ReadableStream<Uint8Array>>

  /**
   * 删除文件。
   * @param key — 存储键
   * @returns void
   * @throws StorageError — 删除失败（连接中断、权限不足等）
   *
   * 说明：对象不存在时静默成功（幂等）。关联的 documents 表记录删除由上层 Service 负责。
   */
  deleteFile(key: string): Promise<void>

  /**
   * 获取文件访问 URL。
   * @param key — 存储键
   * @returns 可直接访问的内网直连 URL 字符串
   * @throws NotFoundError — 文件不存在
   * @throws StorageError — 存储层异常
   */
  getUrl(key: string): Promise<string>

  /**
   * 获取预签名上传 URL（Phase 6 完善）。
   * @param key — 存储键
   * @param expiry — 过期时间（秒），默认 3600
   * @returns 预签名 URL 字符串
   * @throws StorageError — 功能未实现或生成失败
   *
   * MVP 阶段：抛出 StorageError，消息提示 "预签名 URL 尚未实现（Phase 6）"。
   */
  getPresignedUploadUrl(key: string, expiry?: number): Promise<string>
}
```

#### 方法映射关系

| StorageService 方法 | 底层 MinIOStorageProvider 方法 | 说明 |
|---------------------|-------------------------------|------|
| `uploadFile(buffer, key, mimeType)` | `upload(key, stream, contentType)` | 将 Buffer 包装为 ReadableStream 后调用底层 |
| `downloadFile(key)` | `download(key)` | 直接透传 |
| `deleteFile(key)` | `delete(key)` | 直接透传 |
| `getUrl(key)` | `getUrl(key)` | 直接透传，不传递 options |
| `getPresignedUploadUrl(key, expiry)` | `getPresignedUploadUrl(key, expiry)` | 直接透传 |

---

## 2. NestJS 模块定义

### 2.1 StorageModule

```typescript
import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { StorageService } from './storage.service.js'
import { storageProvider } from './storage.provider.js'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [storageProvider, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
```

### 2.2 StorageProvider（Factory Provider）

```typescript
import { Provider } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MinIOStorageProvider } from '../../storage/minio.js'
import type { MinIOConfig } from '../../config/storage.js'

export const storageProvider: Provider = {
  provide: 'STORAGE_PROVIDER',
  useFactory: async (configService: ConfigService): Promise<MinIOStorageProvider> => {
    const config: MinIOConfig = {
      endpoint: configService.getOrThrow<string>('MINIO_ENDPOINT'),
      accessKey: configService.getOrThrow<string>('MINIO_ACCESS_KEY'),
      secretKey: configService.getOrThrow<string>('MINIO_SECRET_KEY'),
      bucket: configService.get<string>('MINIO_BUCKET') ?? 'goferbot-files',
      region: configService.get<string>('MINIO_REGION') ?? 'us-east-1',
      useSSL: configService.get<string>('MINIO_ENDPOINT')?.startsWith('https') ?? false,
    }

    const provider = new MinIOStorageProvider(config)
    await provider.initialize()
    return provider
  },
  inject: [ConfigService],
}
```

### 2.3 StorageService 注入方式

```typescript
import { Injectable, Inject } from '@nestjs/common'
import type { IStorageProvider, StorageMeta, StorageUrlOptions } from '../../interfaces/IStorageProvider.js'
import { MinIOStorageProvider } from '../../storage/minio.js'

@Injectable()
export class StorageService implements IStorageProvider {
  constructor(
    @Inject('STORAGE_PROVIDER')
    private readonly provider: MinIOStorageProvider
  ) {}

  // ... 方法实现委托给 this.provider
}
```

---

## 3. 数据类型

### 3.1 StorageMeta（已有，i-00-core-interfaces 定义）

```typescript
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

### 3.2 StorageUrlOptions（已有）

```typescript
export interface StorageUrlOptions {
  /** 预签名 URL 过期时间（秒），默认 3600 */
  expiresIn?: number
}
```

---

## 4. 配置接口

### 4.1 MinIOConfig（已有，i-03-minio-client 定义）

```typescript
export interface MinIOConfig {
  /** MinIO 服务端点，如 localhost */
  endpoint: string
  /** 端口，如 9000 */
  port?: number
  /** Access Key */
  accessKey: string
  /** Secret Key */
  secretKey: string
  /** Bucket 名称，默认 goferbot-files */
  bucket: string
  /** Region，默认 us-east-1 */
  region?: string
  /** 是否使用 SSL */
  useSSL?: boolean
}
```

### 4.2 配置读取规则

| 环境变量 | ConfigService 键 | 必填 | 默认值 | 说明 |
|----------|-----------------|------|--------|------|
| `MINIO_ENDPOINT` | `MINIO_ENDPOINT` | 是 | — | 如 `http://localhost:9000`；若包含协议头，需解析出 `useSSL` 与 `host:port` |
| `MINIO_ACCESS_KEY` | `MINIO_ACCESS_KEY` | 是 | — | Access Key |
| `MINIO_SECRET_KEY` | `MINIO_SECRET_KEY` | 是 | — | Secret Key |
| `MINIO_BUCKET` | `MINIO_BUCKET` | 否 | `goferbot-files` | Bucket 名称 |
| `MINIO_REGION` | `MINIO_REGION` | 否 | `us-east-1` | Region |

**配置解析说明**：
- `MINIO_ENDPOINT` 可能为完整 URL（如 `http://localhost:9000`），Factory Provider 中需解析协议（`http`/`https`）、主机名与端口，以适配 `MinIOConfig` 的 `endpoint`/`port`/`useSSL` 字段。
- 若 `MINIO_ENDPOINT` 仅为域名（如 `minio.example.com`），默认端口 `9000`，协议默认 `http`。

---

## 5. 调用约定

### 5.1 模块注册

在 `AppModule` 中导入：

```typescript
import { Module } from '@nestjs/common'
import { StorageModule } from './processors/storage/storage.module.js'

@Module({
  imports: [StorageModule, /* ...其他模块 */],
})
export class AppModule {}
```

### 5.2 Service 注入示例

```typescript
import { Injectable } from '@nestjs/common'
import { StorageService } from '../processors/storage/storage.service.js'

@Injectable()
export class DocumentService {
  constructor(private readonly storage: StorageService) {}

  async uploadDocument(file: Express.Multer.File, userId: string, kbId: string, docId: string) {
    const key = `users/${userId}/kb/${kbId}/${docId}_${file.originalname}`
    const meta = await this.storage.uploadFile(file.buffer, key, file.mimetype)
    // meta.key / meta.size / meta.etag 回写至 documents 表
    return meta
  }

  async downloadDocument(storageKey: string) {
    return this.storage.downloadFile(storageKey)
  }

  async deleteDocument(storageKey: string) {
    await this.storage.deleteFile(storageKey)
    // 上层随后执行 DELETE FROM documents WHERE storage_key = storageKey
  }
}
```

### 5.3 上传示例（Buffer → Stream）

`uploadFile` 内部将 `Buffer` 转换为 `ReadableStream<Uint8Array>` 或 `NodeJS.ReadableStream` 后调用底层 `MinIOStorageProvider.upload`：

```typescript
async uploadFile(buffer: Buffer, key: string, mimeType: string): Promise<StorageMeta> {
  if (!buffer || buffer.length === 0) {
    throw new ValidationError('上传文件 buffer 不能为空')
  }
  // Buffer 可直接作为 NodeJS.ReadableStream 传入 minio SDK
  const stream = Readable.from(buffer)
  return this.provider.upload(key, stream, mimeType)
}
```

---

## 6. 无外部 REST API

本层不暴露任何 HTTP 端点。与外部客户端的交互通过以下 NestJS Controller 间接完成：

| 业务端点 | 所在模块 | 说明 |
|----------|----------|------|
| `POST /api/knowledge-bases/:id/documents` | 文档模块 | 接收文件 → 调用 `storage.uploadFile` |
| `GET /api/knowledge-bases/:id/documents/:docId/download` | 文档模块 | 调用 `storage.downloadFile` 后返回流 |
| `DELETE /api/knowledge-bases/:id/documents/:docId` | 文档模块 | 调用 `storage.deleteFile` 后删除 DB 记录 |

---

## 7. 环境变量清单

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `MINIO_ENDPOINT` | 是 | — | MinIO 服务地址，如 `http://localhost:9000` |
| `MINIO_ACCESS_KEY` | 是 | — | Access Key |
| `MINIO_SECRET_KEY` | 是 | — | Secret Key |
| `MINIO_BUCKET` | 否 | `goferbot-files` | 使用的 bucket 名称 |
| `MINIO_REGION` | 否 | `us-east-1` | Region |
