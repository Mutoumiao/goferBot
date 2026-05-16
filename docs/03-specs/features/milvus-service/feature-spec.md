# Feature Spec: Milvus Service（NestJS 封装）

> Issue: i-12-milvus-service
> 状态: 草案
> 日期: 2026-05-16

---

## 1. 用户故事

- 作为后端开发者，我希望 Milvus 客户端以 NestJS Injectable Service 的形式存在，以便在业务模块中通过依赖注入使用向量存储能力。
- 作为后端开发者，我希望向量存储配置通过 NestJS `ConfigService` 统一管理，以便与现有配置体系保持一致。
- 作为业务模块开发者，我希望 `VectorService` 作为全局模块导出，以便在任何模块中无需重复导入即可使用。

---

## 2. 范围

### 2.1 范围内

- 将现有 `MilvusVectorStore` 封装为 NestJS `@Injectable()` Service。
- 创建 `@Global()` 的 `VectorModule`，向全应用提供 `VectorService`。
- 配置从 `ConfigService` 读取：`MILVUS_HOST`、`MILVUS_PORT`、`MILVUS_COLLECTION`、`MILVUS_VECTOR_DIM`。
- 实现 `IVectorStore` 接口，复用 `packages/server/src/vector/milvus.ts` 核心逻辑。
- 提供 `ensureCollection()`、`insertVectors()`、`searchVectors()`、`deleteByIds()`、`deleteByFileId()`、`deleteByKbId()` 方法。
- 应用启动时自动检查 Milvus 连接并确保 Collection 存在。

### 2.2 范围外

- Embedding 生成（由 RAG SDK / Embedding API 负责）。
- 混合检索（向量 + 关键词，Phase 5）。
- Rerank 逻辑（Phase 5 后期）。
- 多 Collection 支持（MVP 仅单 Collection）。
- 向量数据库本身的运维（备份、扩缩容）。
- Milvus 客户端底层实现细节（由 i-04-milvus-client 负责）。

---

## 3. 涉及模块/文件

| 文件路径 | 说明 |
|---------|------|
| `packages/server/src/processors/vector/vector.module.ts` | `VectorModule`，标记 `@Global()`，注册 `VectorService` 为 Provider 并导出 |
| `packages/server/src/processors/vector/vector.service.ts` | `VectorService`，标记 `@Injectable()`，实现 `IVectorStore` 接口 |
| `packages/server/src/vector/milvus.ts` | 现有 Milvus 客户端实现，被 `VectorService` 委托调用 |
| `packages/server/src/interfaces/IVectorStore.ts` | 接口契约（i-00-core-interfaces 已定义） |
| `packages/server/src/interfaces/errors.ts` | `VectorStoreError` 统一错误类型 |
| `packages/server/src/app.module.ts` | 根模块，导入 `VectorModule` |

---

## 4. 依赖关系

### 4.1 与 i-04-milvus-client 的关系

- `i-04` 已完成 `MilvusVectorStore` 类（`packages/server/src/vector/milvus.ts`），提供底层连接、Collection 管理、向量 CRUD。
- `i-12` 负责将其封装为 NestJS Service，不重复实现 Milvus 协议逻辑，而是委托给现有 `MilvusVectorStore` 实例。

### 4.2 与 i-08-nestjs-server-setup 的关系

- `i-08` 建立了 NestJS 项目骨架、全局拦截器、异常过滤器、`ConfigModule`。
- `i-12` 依赖 `ConfigModule` 读取 Milvus 配置，依赖 `AppModule` 导入 `VectorModule`。

### 4.3 与 d-01-rag-sdk-contracts 的关系

- RAG SDK 的 `IIndexer` / `IRetriever` 将注入 `VectorService`（通过 `IVectorStore` 接口）。
- `VectorService` 是 `IVectorStore` 的 V2（Milvus）实现，V1 为 sqlite-vec 实现。

### 4.4 与 b-XX 业务模块的关系

- 文档删除模块调用 `VectorService.deleteByFileId(fileId)` 清理向量。
- 知识库删除模块调用 `VectorService.deleteByKbId(kbId)` 批量清理向量。
- 聊天模块（Phase 4 RAG 预留）调用 `VectorService.searchVectors()` 检索相关 chunk。

---

## 5. 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| `VectorModule` 标记为 `@Global()` | 向量存储是通用基础设施，被 RAG、文档、知识库等多个模块使用，全局注册避免重复导入 | 是（可改为局部导入） |
| `VectorService` 委托现有 `MilvusVectorStore` 而非直接继承 | `MilvusVectorStore` 已完整实现且经过测试；委托模式保持 NestJS 生命周期与底层客户端解耦 | 是（可改为直接继承或内联实现） |
| 配置从 `ConfigService` 读取而非环境变量直接访问 | 与 NestJS 配置体系一致，支持 `.env`、运行时配置、配置验证 | 否（NestJS 最佳实践） |
| `ensureCollection()` 在 `onModuleInit()` 中调用 | 利用 NestJS 生命周期钩子，确保应用启动时 Collection 就绪，避免业务请求时延迟创建 | 是（可改为显式手动调用） |
| 保留 `deleteByFileId` / `deleteByKbId` 作为 Service 扩展方法 | 业务层高频操作（删除文档/知识库时清理向量），不在 `IVectorStore` 接口中，但由 Service 直接暴露 | 是（可下沉到 RAG SDK） |

---

## 6. 非功能性需求

- 启动时必须在 5 秒内完成 Milvus 连接检查与 Collection 确保。
- 批量插入单次上限 1000 条（Milvus 推荐值，由底层 `MilvusVectorStore` 保证）。
- 搜索超时默认 10 秒（由底层 `MilvusVectorStore` 保证）。
- 所有错误必须包装为 `VectorStoreError`，保留原始 cause。
- `pnpm type-check` 必须通过。
