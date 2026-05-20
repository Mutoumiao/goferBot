---
issue_id: i-00-core-interfaces
type: feature-spec
status: approved
summary: 定义四个核心抽象接口：IRepository<T>（数据访问）、IStorageProvider（文件存储）、IVectorStore（向量检索）、IAuthProvider（认证），统一异步契约、泛型约束与错误模式，解耦 V1/V2 实现。
---
# Feature Spec: i-00-core-interfaces

## 用户故事

- 作为后端开发者，我希望通过统一的 `IRepository<T>` 接口访问所有 PostgreSQL 元数据表，以便在 V1 SQLite 实现和 V2 PostgreSQL 实现之间无缝切换，而无需修改业务代码。
- 作为文件管理开发者，我希望通过 `IStorageProvider` 接口操作文件存储，以便在本地文件系统（V1）和 MinIO 对象存储（V2）之间切换，且上层上传/下载逻辑零改动。
- 作为 RAG 开发者，我希望通过 `IVectorStore` 接口执行向量写入和 ANN 检索，以便在 sqlite-vec（V1）和 Milvus（V2）之间切换，而无需改动检索流程。
- 作为认证开发者，我希望通过 `IAuthProvider` 接口管理登录/注册/会话，以便在本地自研认证（V1）和 Better Auth（V2）之间切换，且路由守卫逻辑保持不变。

## 边界

### 范围内
- 四个核心 TypeScript 接口的完整方法签名定义
- 接口与 PRD 数据模型的对齐（users、knowledge_bases、folders、documents、chunks、sessions、messages）
- 统一的错误模式、生命周期约定、调用约定
- 接口的统一导出（`packages/server/src/interfaces/index.ts`）

### 范围外
- 任何具体实现（由 i-02 ~ i-04 及后续 issue 负责）
- 性能优化（如连接池、批量插入策略）
- 前端接口或 HTTP API 路由定义

## 涉及文件

| 文件 | 说明 |
|------|------|
| `packages/server/src/interfaces/IRepository.ts` | 泛型数据访问接口 |
| `packages/server/src/interfaces/IStorageProvider.ts` | 文件存储接口 |
| `packages/server/src/interfaces/IVectorStore.ts` | 向量存储接口 |
| `packages/server/src/interfaces/IAuthProvider.ts` | 认证接口 |
| `packages/server/src/interfaces/index.ts` | 统一导出 |

## 已做决策

| 决策 | 说明 |
|------|------|
| 接口层位于 `packages/server` | 接口是后端数据访问的契约，供 Hono 路由和 Service 层使用 |
| `IRepository<T>` 采用泛型设计 | 一个接口覆盖所有 PostgreSQL 元数据表，避免为每张表定义独立接口 |
| 所有接口方法返回 `Promise` | 强制异步抽象，避免 V1 中 better-sqlite3 同步 API 的紧耦合 |
| 错误统一使用 `Error` 子类 | 不依赖具体库的异常类型，调用方通过 `instanceof` 判断错误类别 |
| `IAuthProvider.middleware` 返回 Hono Middleware | 与 Hono 框架解耦程度适中，既不过度抽象也不深度耦合 |
| `IVectorStore` 的 `ensureCollection` 幂等 | 启动时自动检查并创建 collection，避免外部手动运维 |
