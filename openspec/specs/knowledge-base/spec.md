# Knowledge Base - 知识库管理

## Purpose（目的）

定义 GoferBot 知识库的 CRUD 操作、文件夹树形结构、文件上传与管理、以及知识库与用户之间的归属关系的系统级规范。

## Requirements（需求）

### Requirement: 知识库 CRUD
系统应允许已认证用户创建、读取、更新和删除自己的知识库。

证据来源：
- `packages/web/src/api/KnowledgeBase.ts`
- `packages/web/src/features/kb/services.ts`
- `packages/server/src/modules/` (kb-related services)

#### Scenario: 创建知识库
- **WHEN** 已认证用户使用唯一名称创建知识库
- **THEN** 系统创建 KB 记录，将所有权分配给该用户，并返回 KB 详情

#### Scenario: 列出用户的知识库
- **WHEN** 用户请求其知识库列表
- **THEN** 系统返回该用户拥有的所有 KB，按创建日期排序

#### Scenario: 删除知识库
- **WHEN** 用户删除其拥有的知识库
- **THEN** 系统移除该 KB、其所有文件夹、文档、切片（chunks）以及关联的向量数据

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
系统应支持向知识库上传文档，将文件存储在 MinIO（S3 兼容的对象存储）中，元数据存储在 PostgreSQL 中。

证据来源：
- `packages/web/src/api/file.ts`
- `packages/web/src/features/kb/services.ts`
- `packages/server/src/storage/minio.ts`

#### Scenario: 上传文档
- **WHEN** 用户向知识库文件夹上传文件
- **THEN** 系统将原始文件存储在 MinIO 中，在 PostgreSQL 中创建文档记录，并触发异步切片/索引

#### Scenario: 删除文档
- **WHEN** 用户删除文档
- **THEN** 系统从 MinIO 移除文件，从 PostgreSQL 移除文档记录，并从向量存储中移除所有关联的 chunks/vectors

#### Scenario: 支持的文件类型
- **WHEN** 用户上传文件
- **THEN** 系统应接受 PDF、Markdown、纯文本和常见办公文档格式；对不支持的 MIME 类型返回验证错误

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
