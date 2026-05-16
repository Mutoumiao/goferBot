# Feature Spec: i-03-minio-client

## 1. 功能概述

封装 MinIO 官方 `minio` npm 包，实现 `IStorageProvider` 接口，为 GoferBot Server 提供对象存储能力。文件内容存储于 MinIO，元数据（文件名、大小、状态等）由 PostgreSQL `documents` 表管理。

## 2. 用户故事

- 作为系统，我需要将文件内容存储到对象存储，以便支持大文件和分布式访问。
- 作为开发者，我希望通过 `IStorageProvider` 统一接口操作 MinIO，以便上层业务（文档上传、下载、删除）无需感知具体存储后端。

## 3. 范围

### 3.1 范围内

- MinIO Client 初始化与连接管理。
- Bucket 自动检查与创建（启动时）。
- 文件上传：`Buffer` / `NodeJS.ReadableStream` → MinIO，返回 `StorageMeta`。
- 文件下载：根据 `storageKey` 返回 `ReadableStream<Uint8Array>`。
- 文件删除：根据 `storageKey` 删除对象。
- 获取访问 URL：返回可直接访问的 URL（内网直连或预签名）。
- 自定义 metadata 支持（原始文件名、MIME 类型等）。
- `IStorageProvider` 接口的完整实现。

### 3.2 范围外

- 前端直传（浏览器直接上传至 MinIO）。
- CDN 加速或外部缓存层。
- 预签名 URL 的完整生产级实现（Phase 6 优化，当前仅预留接口）。
- 多 bucket 支持（当前仅使用单一可配置 bucket）。
- 文件版本控制（Versioning）。
- 分片上传（Multipart Upload）的独立暴露。

## 4. 涉及组件

| 组件 | 文件 | 说明 |
|------|------|------|
| `IStorageProvider` 接口 | `packages/server/src/interfaces/IStorageProvider.ts` | 契约层，由 i-00-core-interfaces 定义 |
| MinIO 实现 | `packages/server/src/storage/minio.ts` | 接口的具体实现 |
| 配置 | `packages/server/src/config/storage.ts` | MinIO 连接参数（endpoint、accessKey、secretKey、bucket） |
| 元数据表 | `packages/server/src/db/schema.ts` — `documents` | 存储文件元数据，`storage_key` 关联 MinIO 对象 |

## 5. 与 i-02-drizzle-orm-setup 的关系

- `i-02` 负责 `documents` 表的 Schema 定义与迁移，包含 `storage_key`、`name`、`ext`、`mime_type`、`size`、`status` 等字段。
- `i-03` 负责将文件**内容**写入 MinIO，并将生成的 `storageKey` 回写至 `documents` 表的 `storage_key` 字段。
- 两者通过 `storage_key` 建立一一映射：PostgreSQL 管元数据，MinIO 管二进制内容。

## 6. 关键设计决策

### 6.1 Storage Key 格式

严格遵循 PRD v2 约定：

```
users/<user-id>/kb/<kb-id>/<doc-id>_<filename>
```

示例：
```
users/550e8400-e29b-41d4-a716-446655440000/kb/7c9e6679-7425-40de-944b-e07fc1f90ae7/doc-123_报告.pdf
```

- `user-id`、`kb-id`、`doc-id` 均为 UUID（string）。
- `filename` 保留原始文件名（含扩展名），用于人类可读性。
- Key 中的目录结构仅作逻辑隔离，MinIO 本身为扁平命名空间。

### 6.2 Bucket 名称

- 可配置，默认值为 `goferbot-files`。
- 通过环境变量 `MINIO_BUCKET` 读取，fallback 至默认值。

### 6.3 Metadata 策略

上传时附加以下 user-metadata：

| 键 | 值来源 | 说明 |
|----|--------|------|
| `X-Amz-Meta-Original-Name` | 原始文件名 | 保留用户上传时的文件名 |
| `X-Amz-Meta-Content-Type` | MIME 类型 | 与 HTTP Content-Type 一致 |
| `X-Amz-Meta-Upload-Time` | ISO 8601 时间戳 | 上传时间（服务端生成） |

### 6.4 返回的 URL 类型

MVP 阶段优先返回内网直连 URL（`http(s)://<endpoint>/<bucket>/<key>`），不强制启用预签名。预签名 URL 逻辑在 `getPresignedUploadUrl` 中预留，供 Phase 6 完善。

## 7. 文件结构

```
packages/server/
├── src/
│   ├── storage/
│   │   └── minio.ts          # MinIOStorageProvider 实现
│   ├── config/
│   │   └── storage.ts        # 存储层配置读取
│   └── interfaces/
│       └── IStorageProvider.ts   # 接口契约（i-00 已定义）
```

## 8. 验收标准

- [ ] `packages/server/src/storage/minio.ts` 实现 `IStorageProvider` 接口。
- [ ] 提供 `upload(key, stream, contentType)` 方法，返回 `StorageMeta`。
- [ ] 提供 `download(key)` 方法，返回 `ReadableStream<Uint8Array>`。
- [ ] 提供 `delete(key)` 方法，幂等（对象不存在时静默成功）。
- [ ] 提供 `getUrl(key, options?)` 方法，返回可访问 URL。
- [ ] 提供 `getPresignedUploadUrl(key, expiry)` 方法（预留实现）。
- [ ] Storage Key 遵循 PRD 格式 `users/<user-id>/kb/<kb-id>/<doc-id>_<filename>`。
- [ ] 配置从环境变量读取：`MINIO_ENDPOINT`、`MINIO_ACCESS_KEY`、`MINIO_SECRET_KEY`、`MINIO_BUCKET`。
- [ ] 服务启动时自动检查 bucket，不存在则创建。
- [ ] 所有方法具备类型安全签名，错误统一包装为 `StorageError` / `NotFoundError`。
