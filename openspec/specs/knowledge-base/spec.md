# Knowledge Base - 知识库管理

## Purpose（目的）

定义 GoferBot 知识库的 CRUD 操作、文件夹树形结构、文件上传与管理、以及知识库与用户之间的归属关系的系统级规范。

## Requirements（需求）

### Requirement: 知识库 CRUD
系统应允许已认证用户创建、读取、更新和删除自己的知识库。删除知识库时，系统 MUST 删除业务侧文件夹与文档元数据，并 MUST 触发 Knowledge AI 清理该 KB 下全部索引数据（PG `knowledge` + ES）；Nest Prisma MUST NOT 再以「事务内直接删业务 chunks 表」作为知识索引清理的权威方式。

证据来源：
- `packages/server/src/modules/knowledge-base/kb-cleanup.service.ts`
- `packages/server/src/processors/knowledge-ai/knowledge-ai.client.ts`

#### Scenario: 创建知识库
- **WHEN** 已认证用户使用唯一名称创建知识库
- **THEN** 系统创建 KB 记录，将所有权分配给该用户，并返回 KB 详情

#### Scenario: 列出用户的知识库
- **WHEN** 用户请求其知识库列表
- **THEN** 系统返回该用户拥有的所有 KB，按创建日期排序

#### Scenario: 删除知识库级联索引
- **WHEN** 用户删除其拥有的知识库
- **THEN** 系统 MUST 移除该 KB 及其文件夹、文档业务记录，并 MUST 调用 Knowledge AI 清理该 `kb_id` 下全部向量与全文索引（优先 `DELETE /kb/{kb_id}`）
- **AND** 清理成功后以该 kb_id 检索 MUST NOT 再命中旧内容
- **AND** Knowledge AI 清理失败时 MUST 阻断业务删除并返回失败，以便重试（fail-closed）

#### Scenario: 无法访问其他用户的 KB
- **WHEN** 用户尝试访问不属于自己的知识库
- **THEN** 系统返回 404（而非 403，以避免泄露资源存在性）

### Requirement: 文件夹树形结构
系统应支持在每个知识库内使用分层文件夹树来组织文档。

证据来源：
- `packages/server/src/modules/` (folder-related logic)
- `packages/web/src/features/kb/components/FolderTree.tsx`
- `packages/data/src/schemas/folder.schema.ts`

#### Scenario: 创建嵌套文件夹
- **WHEN** 用户在另一个文件夹内创建文件夹
- **THEN** 系统存储父子关系并返回嵌套结构

#### Scenario: 移动文件夹
- **WHEN** 用户将文件夹移动到不同的父文件夹
- **THEN** 系统更新父引用，并应防止循环引用

#### Scenario: 删除包含内容的文件夹
- **WHEN** 用户删除非空文件夹
- **THEN** 系统移除该文件夹及其所有后代（文档和子文件夹）

### Requirement: 文件上传与管理
系统应支持向知识库上传文档，将文件存储在 MinIO 中，元数据存储在业务 PostgreSQL，并异步触发索引。索引计算 MUST 由 Knowledge AI 执行（Nest 负责抽文本后调用 `/index`）。

#### Scenario: 上传文档
- **WHEN** 用户向知识库文件夹上传文件
- **THEN** 系统将原始文件存 MinIO，创建文档记录，并触发异步索引编排

#### Scenario: 删除文档级联索引
- **WHEN** 用户删除文档
- **THEN** 系统 MUST 先请求 Knowledge AI `DELETE /documents/{id}` 清理索引，再从业务库与 MinIO 移除文档

#### Scenario: Phase 1 支持的文件类型
- **WHEN** 用户上传文件
- **THEN** Phase 1 MUST 对 **txt / markdown / pdf** 给出可预期行为（索引成功或明确 failed+原因）；不支持的类型 MUST 校验失败。docx 等办公格式 MAY 后置

### Requirement: 文档索引状态与手动重试

文档 MUST 暴露可观察的索引状态（至少 `indexing` / `ready` / `failed`）。failed 时 MUST 提供可读原因，并 SHOULD 支持用户或 API **手动重试**索引。重试时 Nest MUST 重新从 MinIO 读取并抽文本后调用 Knowledge AI `/index`（replace 语义）。

#### Scenario: 失败可重试

- **WHEN** 文档状态为 failed 且用户触发重试
- **THEN** 系统 MUST 重新编排抽文本与 `/index`，成功后状态 MUST 变为 `ready`

#### Scenario: 仅 ready 可召回

- **WHEN** 文档尚未 `ready`
- **THEN** 其内容 MUST NOT 作为成功知识问答的合格召回来源

### Requirement: 知识库所有权
系统应强制执行严格的所有权：只有知识库所有者可以通过 API 修改它或访问其内容。

证据来源：
- `packages/server/src/modules/chat/chat.service.ts` (verifyKbOwnership pattern)
- `packages/server/src/auth/guards/permission.guard.ts`

#### Scenario: 所有 KB 操作的所有权验证
- **WHEN** 调用任何 KB 作用域的 API 端点
- **THEN** 系统应在处理请求前验证请求用户是否为 KB 所有者

#### Scenario: 管理员绕过 KB 管理限制
- **WHEN** SUPER_ADMIN 用户访问 KB 管理端点
- **THEN** 系统可允许访问任何 KB 以进行管理目的
