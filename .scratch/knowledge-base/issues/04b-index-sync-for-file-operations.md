Status: ready-for-agent
Category: enhancement

## What to build

在 #04（RAG 索引检索）完成后，补充文件操作后的索引同步逻辑。#03b 已经实现了文件和知识库的物理操作及前端 UI，但以下场景需要同步更新 RAG 索引数据（`document_chunks`、`vec_document_chunks`、`fts_document_chunks`），否则检索结果会指向不存在的文件路径或遗漏新文件：

1. **跨库移动文件**：文件从知识库 A 移动到知识库 B 后，源知识库需移除该文件的索引记录，目标知识库需重新索引该文件
2. **跨库复制文件**：文件复制到目标知识库后，目标知识库需重新索引该副本
3. **知识库重命名**：物理目录从 `docs/<旧名>/` 变为 `docs/<新名>/`，`document_chunks` 表中所有该知识库记录的 `file_path` 前缀需同步更新
4. **文件重命名**：文件路径变更后，`document_chunks` 表中对应记录的 `file_path` 需同步更新

端到端行为：用户在 #03b 中执行跨库移动/复制、重命名知识库或文件后，sidecar 自动将受影响的文件加入索引队列（复用 #04 的后台索引队列机制），前端显示索引进度。索引完成后，目标知识库的检索结果准确反映最新文件状态。

## Acceptance criteria

- [ ] Sidecar：`POST /files/move` 处理完成后，将源文件从源知识库的 `document_chunks` + `vec_document_chunks` + `fts_document_chunks` 中移除，将文件加入目标知识库的索引队列
- [ ] Sidecar：`POST /files/copy` 处理完成后，将副本加入目标知识库的索引队列
- [ ] Sidecar：知识库重命名（`PATCH /knowledge-bases/:id` 名称变更）后，同步更新 `document_chunks` 表中该知识库所有记录的 `file_path` 前缀（`docs/<旧名>/...` → `docs/<新名>/...`），同时更新 `vec_document_chunks` 和 `fts_document_chunks` 中的关联记录
- [ ] Sidecar：文件重命名（`PATCH /knowledge-bases/:id/files/:path`）后，同步更新 `document_chunks` 表中对应记录的 `file_path`
- [ ] 前端：跨库移动/复制后，目标知识库管理页显示新增文件的索引状态（排队中/已索引）
- [ ] 前端：知识库重命名和文件重命名后，知识库管理页的文件索引状态保持一致
- [ ] 索引队列需支持"增量更新"模式：对于移动/复制/重命名的文件，避免全量重建索引，只做必要的删除+重新索引

## Blocked by

- [03-knowledge-base-management](../03-knowledge-base-management.md) — 必须先有知识库和文件系统基础
- [03b-kb-context-menus](../03b-kb-context-menus-and-file-operations.md) — 必须先有文件操作 API 和前端 UI
- [04-rag-indexing-retrieval](../04-rag-indexing-retrieval.md) — 必须先有索引队列、`sqlite-vec` 扩展和 FTS5 索引

## Comments

> 本 issue 是 #03b 的后续补充，专门处理文件操作与 RAG 索引之间的数据一致性。

## Agent Brief

**Category:** enhancement
**Summary:** 补充 #03b 文件操作后的 RAG 索引同步逻辑，确保物理文件操作与 `document_chunks` / `vec_document_chunks` / `fts_document_chunks` 保持一致。

**Current behavior:**
#03b 已实现跨库移动/复制、重命名、新建文件夹等文件操作的前端 UI 和物理文件操作，但执行这些操作后 RAG 索引数据不会自动更新。例如：将文件从知识库 A 移动到知识库 B 后，知识库 A 的检索仍可能返回该文件（已不存在），知识库 B 的检索则找不到该文件（尚未索引）。

**Desired behavior:**
文件操作完成后，sidecar 自动同步更新索引数据：移除旧记录的索引、为新位置的文件重新建立索引。用户无需手动触发"重建索引"。

**Key interfaces:**
- #04 的索引队列机制 — 复用后台队列逐个处理索引任务
- `document_chunks` / `vec_document_chunks` / `fts_document_chunks` — 需要同步更新的三张表
- `POST /files/move` / `POST /files/copy` / `PATCH /knowledge-bases/:id` / `PATCH /knowledge-bases/:id/files/:path` — #03b 已实现的 API，本 issue 在其 handler 中补充索引同步逻辑

**Acceptance criteria:**
- [ ] 跨库移动：源知识库移除索引，目标知识库重新索引
- [ ] 跨库复制：目标知识库重新索引副本
- [ ] 知识库重命名：同步更新所有 `document_chunks.file_path` 前缀
- [ ] 文件重命名：同步更新对应 `document_chunks.file_path`
- [ ] 前端显示索引进度状态

**Out of scope:**
- 新的前端页面或 UI 组件（由 #03b 提供）
- 索引队列本身的实现（由 #04 提供）
- 端到端 E2E 测试
