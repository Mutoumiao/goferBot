# GoferBot Discovery Report

## 7. 复杂模块

### 7.5 processors/ 基础设施层 — Database + Storage

**数据来源**：[prisma.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/processors/database/prisma.service.ts) / [database.module.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/processors/database/database.module.ts) / [storage.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/processors/storage/storage.service.ts) / [storage.provider.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/processors/storage/storage.provider.ts) / [storage.module.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/processors/storage/storage.module.ts)

#### DatabaseModule（@Global, 全应用自动注入）

- 提供 `PrismaService` + `TransactionManager`
- `PrismaService` 并非简单 re-export：通过 `client.$extends({ model: { $allModels } })` 注入 2 个自定义方法
  - `paginate(page, size)` → `PaginationResult<total, size, totalPage, currentPage, hasNextPage, hasPrevPage>`
  - `exists(where)` → boolean（count > 0）
- 通过 23 个 getter 代理全部 Prisma 模型：user / session / message / knowledgeBase / folder / document / chunk / setting / companion*6 / groupChat*3 / authSession / refreshToken / userRole / application / applicationAuthMethod / permission / rolePermission
- 实现 `OnModuleInit` / `OnModuleDestroy` 生命周期

#### StorageModule（@Global, 工厂降级 + 委托模式）

```
ConfigService → storageProvider(Factory) → MinIOStorageProvider | null → StorageService(Delegate)
```

- **工厂降级**：`storageProvider.useFactory` 读取 MINIO_ENDPOINT / MINIO_ACCESS_KEY / MINIO_SECRET_KEY / MINIO_BUCKET。未配置时返回 `null`（不抛异常）→ 运行时不中断启动
- **委托守卫**：`StorageService.ensureProvider()` 在 provider 为 null 时抛出 `STORAGE_NOT_CONFIGURED(503)`，阻止未配置环境下的误操作
- **6 个存储操作**：uploadFile / downloadFile / deleteFile / getUrl / extractKeyFromUrl / getPresignedUploadUrl，全部实现 `IStorageProvider` 接口

#### 跨层依赖架构（重要修正）

原先认为 `modules/` 与 `processors/` 是清晰的单向分层，实际代码揭示了**双向依赖**的 pragmatic 模式：

| 方向                 | 引用数 | 典型示例                                                                                                                                                                                                            |
|----------------------|--------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| modules → processors | 32 处  | 全部模块注入 PrismaService；knowledge-base 注入 StorageService / QueueService / RagModule                                                                                                                           |
| processors → modules | 30 处  | processors/rag/ 依赖 modules/settings/（SystemConfigService + ModelProviderService + DTO 类型）；processors/queue/ 依赖 ChatModule + SettingsModule；processors/chat/ 依赖 ConversationService + ProviderRegistry |

**结论**：`processors/` 并非纯基础设施层，而是**二层结构**——

- **纯基础设施**：`database/`、`storage/` — 仅被依赖，不依赖 modules
- **编排处理器**：`rag/`、`queue/`、`chat/` — 需要 LLM 配置和领域类型，合法地依赖 modules；部分通过 NestJS EventEmitter（listeners → domain events）实现松耦合

这并非架构违规，而是 NestJS monorepo 中常见的 pragmatic 分层模式。
