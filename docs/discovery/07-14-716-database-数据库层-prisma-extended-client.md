# GoferBot Discovery Report

## 7. 复杂模块

### 7.16 Database 数据库层 — Prisma Extended Client

**数据来源**：[prisma.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/processors/database/prisma.service.ts)、[database.module.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/processors/database/database.module.ts)

PrismaService 通过 `$extends({model: {$allModels: {paginate, exists}}})` 为所有 24+ Prisma 模型统一注入两个通用方法：

**paginate() 分页方法**：
- 输入：`{where, select/omit, orderBy}, {page, size}`
- 内部并行执行 `count(where)` + `findMany({...where, take:size, skip})`
- 返回：`{data: T[], pagination: {total, size, totalPage, currentPage, hasNextPage, hasPrevPage}}`

**exists() 存在性检查**：
- 输入：`{where}`，执行 `count(where) > 0`
- 返回 boolean

**模型代理**：通过 getter 暴露所有 Prisma 模型（user/session/message/knowledgeBase/folder/document/chunk/setting/companion*/groupChat*/auth*/permission/rolePermission/application*），每个 getter 返回扩展后的模型（含 paginate + exists）

**生命周期管理**：`OnModuleInit → $connect()` / `OnModuleDestroy → $disconnect()`（disconnect 错误被吞，不阻塞关闭流程）

**DatabaseModule**：`@Global()`，导出 `PrismaService + TransactionManager`
