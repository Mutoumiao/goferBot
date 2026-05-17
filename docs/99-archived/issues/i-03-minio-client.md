---
id: i-03-minio-client
type: issue
status: closed
track: infra
priority: p1
summary: 封装 MinIO Client，提供文件上传、下载、删除、获取 Presigned URL 等操作。后端可通过统一接口操作 MinIO，支持上传、下载、删除文件。
blocked_by: [i-00-core-interfaces, i-01-docker-compose-infra]
blocks: []
archived_reason: 被 i-11-minio-service 替代（NestJS 服务封装，功能更完整）
spec: docs/03-specs/i-03-minio-client/
plan: docs/04-plans/i-03-minio-client/v1.md
tests: docs/08-test-cases/i-03-minio-client/
token_estimate: 1000
---

状态: needs-triage
分类: enhancement

## 要构建的内容

封装 MinIO Client，提供文件上传、下载、删除、获取 Presigned URL 等操作。

## 规格引用

- 功能规格: docs/03-specs/i-03-minio-client/feature-spec.md
- 行为规格: docs/03-specs/i-03-minio-client/behavior-spec.md
- API 规格: 无（基础设施，无 API）

## 验收标准

- [ ] `packages/server/src/storage/minio.ts` 封装 MinIO Client
- [ ] 提供 `uploadFile(buffer, key, mimeType)` 方法
- [ ] 提供 `downloadFile(key)` 方法返回 ReadableStream
- [ ] 提供 `deleteFile(key)` 方法
- [ ] 提供 `getPresignedUploadUrl(key, expiry)` 方法（预留）
- [ ] Storage Key 遵循 PRD 格式：`users/<user-id>/kb/<kb-id>/<doc-id>_<filename>`
- [ ] 配置从环境变量读取（endpoint、accessKey、secretKey、bucket）
- [ ] 启动时检查 bucket 存在，不存在则自动创建
- [ ] 提供类型安全的接口定义

## 阻塞于

- i-00-core-interfaces（需要实现 IStorageProvider 接口）
- i-01-docker-compose-infra（需要 MinIO 服务运行）

## 范围外

- Presigned URL 的完整实现（Phase 6 优化）
- 多 bucket 支持
- 文件版本控制

## Agent 简报

**分类：** enhancement
**摘要：** 封装 MinIO Client，提供文件存储操作能力

**当前行为：**
项目无对象存储访问层。

**期望行为：**
后端可通过统一接口操作 MinIO，支持上传、下载、删除文件，Storage Key 格式统一。

**关键接口：**
- `packages/server/src/storage/minio.ts` — MinIO Client 封装
- `uploadFile(buffer, key, mimeType)` — 上传文件
- `downloadFile(key)` — 下载文件
- `deleteFile(key)` — 删除文件
- `getPresignedUploadUrl(key, expiry)` — 获取预签名上传 URL（预留）

**验收标准：**
- [ ] `packages/server/src/storage/minio.ts` 封装 MinIO Client
- [ ] 提供 `uploadFile` 方法
- [ ] 提供 `downloadFile` 方法
- [ ] 提供 `deleteFile` 方法
- [ ] 提供 `getPresignedUploadUrl` 方法（预留）
- [ ] Storage Key 遵循 PRD 格式
- [ ] 配置从环境变量读取
- [ ] 启动时自动检查/创建 bucket
- [ ] 提供类型安全的接口定义

**范围外：**
- Presigned URL 完整实现
- 多 bucket 支持
- 文件版本控制
