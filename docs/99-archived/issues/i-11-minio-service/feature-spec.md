---
issue_id: i-11-minio-service
type: feature-spec
status: approved
summary: 将 MinIO 客户端封装为 NestJS @Injectable/@Global StorageService，从 ConfigService 读取配置，启动时自动检查/创建 bucket，提供 uploadFile/downloadFile/deleteFile/getUrl 方法，复用 IStorageProvider 接口。
---
# 功能规格：MinIO NestJS Service 封装

## 用户故事

- 作为后端开发者，我希望 MinIO 客户端被封装为 NestJS Injectable Service，以便通过依赖注入在任意模块中使用存储能力。
- 作为后端开发者，我希望存储配置从 NestJS ConfigService 读取，以便利用统一配置管理（环境变量、.env 文件、配置验证）。
- 作为系统，我希望应用启动时自动检查并创建 MinIO bucket，避免因基础设施缺失导致运行时异常。
- 作为业务模块开发者，我希望 StorageModule 标记为 `@Global()`，以便无需在每个业务模块中重复导入即可注入 StorageService。

## 边界

- 范围内：
  - `StorageModule`（`@Global()`）定义与注册
  - `StorageService`（`@Injectable()`）实现，封装 `MinIOStorageProvider`
  - 从 `ConfigService` 读取 MinIO 配置（`MINIO_ENDPOINT`、`MINIO_ACCESS_KEY`、`MINIO_SECRET_KEY`、`MINIO_BUCKET`）
  - 启动时自动检查 bucket 存在性，不存在则创建
  - 实现 `IStorageProvider` 接口，复用现有 `packages/server/src/storage/minio.ts` 核心逻辑
  - 提供 `uploadFile`、`downloadFile`、`deleteFile`、`getUrl`、`getPresignedUploadUrl` 方法
  - `pnpm type-check` 通过

- 范围外：
  - 前端直传（浏览器直接上传至 MinIO，Phase 6 优化）
  - CDN 加速或外部缓存层
  - 预签名 URL 的完整生产级实现（当前仅预留接口，抛出占位异常）
  - 多 bucket 支持
  - 文件版本控制（Versioning）
  - 分片上传（Multipart Upload）的独立暴露
  - REST API 端点（由文档模块等业务层暴露）

## 涉及模块/文件

| 文件路径 | 说明 |
|---------|------|
| `packages/server/src/processors/storage/storage.module.ts` | `@Global()` 全局模块定义，导出 `StorageService` |
| `packages/server/src/processors/storage/storage.service.ts` | `@Injectable()` 服务实现，包装 `MinIOStorageProvider` |
| `packages/server/src/processors/storage/storage.provider.ts` | Factory Provider，负责实例化 `MinIOStorageProvider` 并调用 `initialize()` |
| `packages/server/src/storage/minio.ts` | 现有 MinIO 客户端实现（复用，不修改） |
| `packages/server/src/interfaces/IStorageProvider.ts` | 接口契约（i-00-core-interfaces 已定义） |
| `packages/server/src/config/storage.ts` | 存储层配置读取（复用，不修改） |
| `packages/server/src/app.module.ts` | 根模块导入 `StorageModule` |

## 相关功能

- 上游：
  - i-00-core-interfaces — 提供 `IStorageProvider`、`StorageMeta`、`StorageUrlOptions` 接口定义
  - i-03-minio-client — 提供 `MinIOStorageProvider` 实现与 `packages/server/src/storage/minio.ts`
  - i-08-nestjs-server-setup — 提供 NestJS 模块结构、ConfigModule、全局异常过滤器
- 下游：
  - b-01-auth-api — 用户头像等文件存储（后续可能使用）
  - f-06-knowledge-base-file-manager — 文档上传/下载/删除调用 StorageService
  - f-07-file-upload-component — 文件上传后端支撑

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| `StorageModule` 标记为 `@Global()` | 存储服务为基础设施层通用能力，几乎所有业务模块都会使用；避免重复导入 | 是（可改为按需导入） |
| 使用 Factory Provider 初始化 `MinIOStorageProvider` | 需要在模块初始化时异步调用 `initialize()` 检查/创建 bucket；Factory Provider 支持 `async useFactory` | 否（NestJS 标准做法） |
| `StorageService` 方法签名适配 Buffer 友好型 | issue 要求 `uploadFile(buffer, key, mimeType)`，相比底层 `upload(key, stream, contentType)` 更贴近 Controller 层使用场景（Multer 返回 Buffer） | 是（可统一为流式接口） |
| 复用现有 `src/storage/minio.ts`，不迁移或修改 | 该文件已完成 `IStorageProvider` 实现，逻辑稳定；NestJS 层仅做薄封装，保持关注点分离 | 是（未来可内联） |
| 配置从 `ConfigService` 读取，而非直接读 `process.env` | 符合 NestJS 配置管理规范，支持配置验证、默认值、多环境切换 | 否 |
