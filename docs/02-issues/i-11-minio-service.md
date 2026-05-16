状态: completed
分类: enhancement

## 要构建的内容

将现有 MinIO 客户端封装为 NestJS Injectable Service。

## 背景

i-03-minio-client 已完成 MinIO 客户端实现，需在 NestJS 中封装为 Service，供其他模块依赖注入。

## 规格引用

- 功能规格: `docs/03-specs/features/minio-service/feature-spec.md`
- API 规格: `docs/03-specs/features/minio-service/api-spec.md`

## 验收标准

- [ ] `src/processors/storage/storage.module.ts` — StorageModule（@Global()）
- [ ] `src/processors/storage/storage.service.ts` — StorageService（@Injectable()）
  - `uploadFile(buffer, key, mimeType)` — 上传文件
  - `downloadFile(key)` — 下载文件
  - `deleteFile(key)` — 删除文件
  - `getUrl(key)` — 获取访问 URL
  - `getPresignedUploadUrl(key, expiry)` — 预签名 URL（预留）
- [ ] 实现 `IStorageProvider` 接口
- [ ] 配置从 `ConfigService` 读取（MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET）
- [ ] 启动时检查 bucket 存在，不存在则创建
- [ ] 复用现有 `src/storage/minio.ts` 核心逻辑
- [ ] `pnpm type-check` 通过

## 阻塞于

- i-08-nestjs-server-setup（需要 NestJS 模块结构）

## 范围外

- 前端直传、CDN、预签名 URL 完整实现（Phase 6）
- 多 bucket 支持

## Agent 简报

**分类：** enhancement
**摘要：** MinIO 客户端封装为 NestJS StorageService

**当前行为：**
MinIO 客户端已实现，但为独立模块。

**期望行为：**
MinIO 客户端封装为 NestJS Injectable Service，支持依赖注入。

**关键接口：**
- `StorageService` — 文件存储服务
- `IStorageProvider` — 接口实现

**验收标准：**
- [ ] StorageModule/StorageService
- [ ] 实现 IStorageProvider
- [ ] ConfigService 配置
- [ ] 启动时 bucket 检查
- [ ] type-check 通过

**范围外：**
- 前端直传
- CDN
- 预签名 URL
