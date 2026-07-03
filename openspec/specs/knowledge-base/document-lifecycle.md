# KnowledgeBase - 文档生命周期与文件夹操作

## Purpose（目的）

定义 GoferBot 知识库中文档完整生命周期（上传、移动、复制、删除）和文件夹树操作的系统级规范。覆盖多存储协调的事务边界设计、跨知识库资源迁移的物理约束、文件夹树的递归操作与防环逻辑、事件驱动的异步索引调度。

## Requirements（需求）

### Requirement: 文档上传流程

系统 SHALL 支持文件上传到知识库，上传完成后通过事件驱动异步触发索引。

证据来源：
- `packages/server/src/modules/knowledge-base/document-upload.service.ts`
- `packages/server/src/modules/knowledge-base/events/document-uploaded.event.ts`

#### Scenario: 文件上传（存储 + DB + 事件）

- **WHEN** 用户上传文件到指定知识库的指定文件夹时
- **THEN** 系统执行三步流程：(1) `StorageService.uploadFile` 存储到 MinIO，storageKey 格式为 `{kbId}/{safeName}`（KB-scoped），(2) `DocumentRepository.create` 写入 document 记录（status='uploaded'），(3) 检查 QueueService 健康状态后发射 `DocumentUploadedEvent` 触发异步索引

#### Scenario: 队列不健康时的降级

- **WHEN** 文档上传完成但 QueueService.isHealthy() 返回 false 时
- **THEN** 系统跳过事件发射，不将索引任务入队。QueueService 通过 `@Optional()` 注入，设计上允许无队列降级运行

#### Scenario: 文本创建（无文件上传）

- **WHEN** 用户创建纯文本文档时
- **THEN** 系统生成临时 storageKey（`temp-{uuid}`），创建状态为 'uploaded' 的 document 记录

### Requirement: 跨知识库文档移动

系统 SHALL 支持文档在知识库间移动，因 MinIO storageKey 是 KB-scoped（`buildStorageKey(kbId, name)`），跨 KB 移动必须执行物理重上传。

证据来源：
- `packages/server/src/modules/knowledge-base/document-move.service.ts#L66-L103`
- `packages/server/src/common/utils/filename-sanitizer.ts`

#### Scenario: 同知识库移动（仅改 metadata）

- **WHEN** 目标知识库与源知识库相同时
- **THEN** 系统仅更新 document 的 `folderId` 字段，不操作存储

#### Scenario: 跨知识库移动（物理重上传）

- **WHEN** 目标知识库与源知识库不同时
- **THEN** 系统执行：(1) 验证文件大小 ≤ 50MB，(2) `StorageService.downloadFile` 从源 KB storageKey 下载到内存，(3) `buildStorageKey(targetKbId, name)` 生成新 storageKey，(4) `StorageService.uploadFile` 上传到新 KB，(5) 删除旧 chunks，(6) 更新 document 的 `kbId/folderId/storageKey/status`，(7) 异步清理旧存储→入队重新索引

#### Scenario: 大文件跨 KB 移动警告

- **WHEN** 跨 KB 移动的文件 > 5MB 时
- **THEN** 系统记录 warn 日志（`跨知识库移动大文件（{size} bytes），可能占用较多内存`），但继续执行

#### Scenario: 跨 KB 移动大小限制

- **WHEN** 跨 KB 移动的文件 > 50MB 时
- **THEN** 系统返回 `PAYLOAD_TOO_LARGE` 错误，拒绝移动

#### Scenario: 跨 KB 移动后清理旧存储

- **WHEN** 跨 KB 移动完成数据库更新后
- **THEN** 系统调用 `KbCleanupService.cleanupDocument(docId, oldStorageKey)` 清理旧存储和 ES 索引，清理失败只 log 警告不阻塞结果返回

### Requirement: 跨知识库文档复制

系统 SHALL 支持文档在知识库间复制，同 KB 和跨 KB 均需要物理重上传（创建独立副本）。

证据来源：
- `packages/server/src/modules/knowledge-base/document-move.service.ts#L150-L227`

#### Scenario: 跨 KB 文档复制

- **WHEN** 文档复制到不同知识库时
- **THEN** 系统执行：(1) 验证 ≤ 50MB，(2) download → buildStorageKey → upload 到目标 KB，(3) `DocumentRepository.create` 新建 document 记录，(4) 入队重新索引

#### Scenario: 同 KB 文档复制

- **WHEN** 文档在同一知识库内复制时
- **THEN** 系统执行相同的 download → upload → create 流程，确保两个文档拥有独立的 storageKey 和记录

### Requirement: 多存储协调的清理事务边界

系统 SHALL 在知识库/文件夹/文档清理时采用多存储分离事务策略：DB 操作走 Prisma 事务保证原子性，ES 和 MinIO 操作在事务外执行，各自 `.catch()` 吞异常且仅 warn 日志。

证据来源：
- `packages/server/src/modules/knowledge-base/kb-cleanup.service.ts`

#### Scenario: 知识库级清理

- **WHEN** 删除整个知识库时
- **THEN** 系统执行：(1) 查询该 KB 下所有文档，(2) Prisma `$transaction` 内批量删除 chunks → documents → knowledgeBase，(3) 事务外 `ES.deleteByKbId(kbId).catch(warn)`，(4) 事务外逐文档 `StorageService.deleteFile(storageKey).catch(warn)`

#### Scenario: 文件夹级清理

- **WHEN** 删除文件夹时
- **THEN** 系统执行：(1) BFS 遍历文件夹树收集所有子文档（避免事务内逐层查询），(2) Prisma `$transaction` 内批量删除 chunks → documents，(3) 事务外删除 folder 记录，(4) 事务外逐文档删除 ES 索引，(5) 事务外逐文档删除 MinIO 文件

#### Scenario: 文档级清理

- **WHEN** 删除单个文档时
- **THEN** 系统执行：(1) Prisma `$transaction` 内删除 chunks → document，(2) 事务外 `ES.deleteByDocumentId(documentId).catch(warn)`，(3) 事务外 `StorageService.deleteFile(storageKey).catch(warn)`

#### Scenario: 外部存储失败不阻塞 DB 事务

- **WHEN** ES 删除或 MinIO 文件删除失败时
- **THEN** 系统仅记录 warn 日志，不影响数据库事务提交。设计原理：外部存储操作不在 DB 事务内执行，避免外部存储失败导致 DB 事务回滚造成数据不一致

### Requirement: 文件夹移动

系统 SHALL 支持文件夹在同一知识库内移动和在知识库间移动（后者为"复制树 + 删除源"策略）。

证据来源：
- `packages/server/src/modules/knowledge-base/folder-move.service.ts`

#### Scenario: 同 KB 文件夹移动（防环校验）

- **WHEN** 文件夹在同一知识库内移动时
- **THEN** 系统先调用 `assertNotSelfOrDescendant` 使用 PostgreSQL `WITH RECURSIVE` 递归 CTE 检查目标文件夹不是源文件夹的后代，防止循环嵌套

#### Scenario: 跨 KB 文件夹移动 = 复制树 + 删除源

- **WHEN** 文件夹移动到不同知识库时
- **THEN** 系统执行 `copyTree(源) → cleanupFolder(源) → delete(源Folder)`。这不是改 `kbId` 字段，而是完整的"复制粘贴 + 删除源"

### Requirement: 文件夹复制与回滚

系统 SHALL 在文件夹复制时实现应用层补偿事务：先在一个 Prisma 事务中批量创建所有文件夹节点，再逐文件夹复制其下文档，任一文档复制失败时回滚所有已创建的文件夹节点。

证据来源：
- `packages/server/src/modules/knowledge-base/folder-move.service.ts#L100-L137`

#### Scenario: 批量创建文件夹节点

- **WHEN** 复制文件夹树时
- **THEN** 系统从源根节点开始 BFS 遍历（栈实现），在单个 Prisma 事务中逐层创建所有文件夹节点，维护 `srcFolderId → newFolderId` 映射

#### Scenario: 文档复制阶段

- **WHEN** 所有文件夹节点创建完成后
- **THEN** 系统按映射顺序调用 `DocumentMoveService.copy` 逐文档复制到对应目标文件夹

#### Scenario: 文档复制失败时回滚

- **WHEN** 任一文档复制失败时
- **THEN** 系统在 catch 块中遍历已创建的所有文件夹 ID，逐 `prisma.folder.delete()` 回滚，然后抛 `COPY_FAILED` 错误

### Requirement: 文件夹树递归 CTE 操作

系统 SHALL 使用 PostgreSQL `WITH RECURSIVE` 原生 SQL 实现文件夹树的祖先查询和子孙判定，绕过 Prisma ORM 的 N+1 查询问题。

证据来源：
- `packages/server/src/modules/knowledge-base/folder-tree.service.ts#L106-L142`

#### Scenario: 面包屑（祖先查询）

- **WHEN** 查询文件夹的面包屑路径时
- **THEN** 系统使用 `WITH RECURSIVE ancestors AS (SELECT ... WHERE id = folderId UNION ALL SELECT f.* FROM Folder f INNER JOIN ancestors a ON f.id = a.parentId)` 向上递归查询所有祖先，结果 reverse() 返回根到叶的顺序

#### Scenario: 后代判定（防循环移动）

- **WHEN** 移动文件夹前需要验证目标不是源的后代时
- **THEN** 系统使用 `WITH RECURSIVE descendants AS (SELECT ... WHERE id = descendantId UNION ALL SELECT f.* FROM Folder f INNER JOIN descendants d ON f.id = d.parentId) WHERE id = ancestorId AND id != descendantId LIMIT 1` — 找到匹配则目标在源子树中，拒绝操作

#### Scenario: 防重名解析

- **WHEN** 复制或移动文件夹可能导致同名冲突时
- **THEN** `resolveUniqueFolderName` 在同级目录下检查重名，自动追加 ` (1)`、` (2)` 等后缀

### Requirement: 文档状态机

系统 SHALL 维护文档的状态机：`uploaded` → `indexing` → `ready`（成功）或 `failed`（失败）。

证据来源：
- `packages/server/src/processors/queue/indexing.worker.ts`
- `packages/server/src/modules/knowledge-base/document-upload.service.ts`

#### Scenario: 上传后初始状态

- **WHEN** 文档上传或创建完成后
- **THEN** document.status 为 `uploaded`

#### Scenario: 索引进行中

- **WHEN** DocumentUploadedListener 触发或 QueueService.addDocumentJob 入队后
- **THEN** IndexingWorker 将 status 更新为 `indexing`

#### Scenario: 索引成功

- **WHEN** 索引完成（下载→解析→RAG索引）后
- **THEN** status 更新为 `ready`，记录 chunk 数量

#### Scenario: 索引失败

- **WHEN** 索引过程中任何步骤失败
- **THEN** status 更新为 `failed`，附带截断至 500 字符的错误消息
