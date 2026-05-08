# Issue #04b — 文件操作后索引同步 测试用例

**对应 Issue**: `.scratch/knowledge-base/issues/04b-index-sync-for-file-operations.md`  
**状态**: ready-for-agent  
**测试框架**: Node 环境 Vitest（Sidecar API）

---

## 4b.1 Sidecar API — 跨库移动后索引同步

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-04b-001 | 移动后源知识库索引被删除 | 源知识库 A 存在文件 `move.md` 且已建立索引（`document_chunks` 中有记录） | `POST /move` 将 `move.md` 从 A 移动到 B | 源知识库 A 的 `document_chunks` / `vec_document_chunks` / `fts_document_chunks` 中不再包含该文件记录 |
| TC-04b-002 | 移动后目标知识库文件加入索引队列 | 目标知识库 B 存在 | `POST /move` 将文件从 A 移动到 B | 目标知识库 B 的索引队列中包含该文件任务，文件物理存在于 B 目录下 |
| TC-04b-003 | 移动子目录中的文件后索引同步 | 源知识库 A 存在 `sub/move.md` 且已索引 | `POST /move` 移动 `sub/move.md` 到 B 的根目录 | 源 A 中 `sub/move.md` 的索引被删除，目标 B 的队列任务 `relativePath` 为 `move.md` |
| TC-04b-004 | 移动不存在的文件返回 404 | 源路径不存在 | `POST /move` | 返回 404，不操作索引 |

**已有/待补充自动化测试**: `tests/unit/server/indexSync.test.ts`（待创建）  
**覆盖范围**: TC-04b-001 ~ TC-04b-004

---

## 4b.2 Sidecar API — 跨库复制后索引同步

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-04b-005 | 复制后目标知识库文件加入索引队列 | 源知识库 A 存在 `copy.md`，目标知识库 B 存在 | `POST /copy` 将 `copy.md` 从 A 复制到 B | 目标知识库 B 的索引队列中包含该副本任务，B 目录下存在 `copy.md` |
| TC-04b-006 | 复制同名文件时副本也加入索引队列 | 源 A 和目标 B 都已存在 `dup.md` | `POST /copy` 复制 `dup.md` | 目标 B 生成 `dup(1).md`，索引队列任务 `relativePath` 为 `dup(1).md` |
| TC-04b-007 | 复制后源知识库索引不受影响 | 源 A 的 `copy.md` 已索引 | `POST /copy` | 源 A 的 `document_chunks` 记录数量不变 |
| TC-04b-008 | 复制不存在的文件返回 404 | 源路径不存在 | `POST /copy` | 返回 404，不操作索引 |

**已有/待补充自动化测试**: `tests/unit/server/indexSync.test.ts`（待创建）  
**覆盖范围**: TC-04b-005 ~ TC-04b-008

---

## 4b.3 Sidecar API — 知识库重命名后索引同步

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-04b-009 | 知识库重命名后 `document_chunks.file_path` 前缀更新 | 知识库 `OldName` 存在，且 `document_chunks` 中有 `OldName/notes.md` 记录 | `PATCH /:id` 将名称改为 `NewName` | `document_chunks` 中对应记录 `file_path` 变为 `NewName/notes.md` |
| TC-04b-010 | 知识库重命名后 `fts_document_chunks` 关联记录更新 | 同上，且 `fts_document_chunks` 中存在对应记录 | `PATCH /:id` 重命名 | `fts_document_chunks` 中对应记录的 `file_path` 同步更新为 `NewName/notes.md` |
| TC-04b-011 | 仅修改图标不触发索引同步 | 知识库存在，未修改名称 | `PATCH /:id` 只改 `icon` | `document_chunks` 记录无任何变化 |
| TC-04b-012 | 知识库重命名后物理目录正确迁移 | 知识库 `OldName` 目录存在 | `PATCH /:id` 重命名 | `docs/OldName/` 不存在，`docs/NewName/` 存在 |

**已有/待补充自动化测试**: `tests/unit/server/indexSync.test.ts`（待创建）  
**覆盖范围**: TC-04b-009 ~ TC-04b-012

---

## 4b.4 Sidecar API — 文件重命名后索引同步

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-04b-013 | 文件重命名后 `document_chunks.file_path` 更新 | 知识库中存在 `old.md` 且已索引 | `PATCH /:id/files/old.md` 重命名为 `new.md` | `document_chunks` 中该文件记录的 `file_path` 从 `old.md` 变为 `new.md` |
| TC-04b-014 | 文件重命名后 `fts_document_chunks` 关联记录更新 | 同上，且 `fts_document_chunks` 中存在对应记录 | `PATCH /:id/files/old.md` 重命名 | `fts_document_chunks` 中对应记录的 `file_path` 同步更新为 `new.md` |
| TC-04b-015 | 子目录中文件重命名后路径更新 | 知识库中存在 `sub/old.md` 且已索引 | `PATCH /:id/files/sub/old.md` 重命名 | `document_chunks` 中 `file_path` 从 `sub/old.md` 变为 `sub/new.md` |
| TC-04b-016 | 重命名保留文件扩展名 | 知识库中存在 `test.txt` | `PATCH /:id/files/test.txt` 新名为 `renamed` | 物理文件名为 `renamed.txt`，`document_chunks.file_path` 为 `renamed.txt` |

**已有/待补充自动化测试**: `tests/unit/server/indexSync.test.ts`（待创建）  
**覆盖范围**: TC-04b-013 ~ TC-04b-016

---

## 4b.5 Sidecar API — 边界与异常

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-04b-017 | `vec_document_chunks` 无需更新 `file_path` | 任意文件操作后 | 检查 `vec_document_chunks`  schema | `vec_document_chunks` 表不包含 `file_path` 列，因此无需更新 |
| TC-04b-018 | 移动/复制/重命名后索引队列入队参数正确 | 执行文件操作 | 检查 `enqueueIndexTask` 调用参数 | `knowledgeBaseId`、`filePath`（绝对路径）、`relativePath`（相对路径）均正确 |
| TC-04b-019 | 无索引数据的文件操作不报错 | 文件从未被索引（`document_chunks` 中无记录） | 执行移动/复制/重命名 | 操作成功，不抛出错误 |
| TC-04b-020 | 同时操作多个文件时索引一致性 | 批量移动/复制场景（如前端多选） | 逐个调用 API | 每个文件的索引同步独立执行，无并发冲突 |

**已有/待补充自动化测试**: `tests/unit/server/indexSync.test.ts`（待创建）  
**覆盖范围**: TC-04b-017 ~ TC-04b-020

---

*Created: 2026-05-08*
