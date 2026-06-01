---
id: q-21
status: closed
track: quality
priority: p1
summary: RAG Server 集成端到端验证（上传→索引→对话检索完整链路）
blocked_by:
  - b-08
  - b-09
  - f-16
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

验证 RAG Server 集成的完整端到端链路：
1. 文档上传 → 异步索引 → status 变为 ready
2. 对话时选择知识库 → 检索上下文注入 → 回答基于文档内容
3. 不选择知识库 → 对话行为与现有一致

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

### 为什么放在最后

E2E 测试验证的是"用户旅程"，必须等所有组件就绪：
- b-08 完成：索引流水线可运行
- b-09 完成：对话检索 API 可用
- f-16 完成：前端可选择知识库

### 依赖关系

**阻塞下游：**
- 无（本 issue 是验证闭环，不阻塞其他开发）

**被阻塞于：**
- `b-08-indexing-worker-integration` — 需要索引流水线可运行
- `b-09-chat-rag-retrieval` — 需要对话检索 API 可用
- `f-16-chat-kb-selector` — 需要前端可选择知识库

### 测试范围

| 场景 | 验证点 |
|------|--------|
| 上传文本文件 | MinIO 存储 → PG 记录 created → BullMQ job added |
| 索引完成 | Worker 处理 → status 流转 uploaded→chunking→embedding→indexing→ready |
| 对话检索 | 选择知识库 → 提问 → 回答包含文档内容 → SSE 正常流式输出 |
| 无检索对话 | 不选择知识库 → 提问 → 回答基于模型知识 → 无回归 |
| 索引失败 | Embedding API 失败 → Worker 重试 → 最终 status='failed' |

### 技术要点

- 集成测试使用真实数据库（不 mock），符合项目规范
- 需要启动 Docker 基础设施（PG + MinIO + Milvus + Redis）
- 测试环境需提供 Embedding API mock 或测试密钥

### 状态说明（2026-05-29）

本 issue 完成了 E2E 测试骨架（`rag-e2e.spec.ts`），包含基础设施检测和 4 条 AC 的测试结构。

**真实链路验证由 q-22 覆盖**：q-22 在真实 PG + Milvus + Redis + MinIO 环境中验证了索引链路和检索链路，包括失败降级场景。

**已知限制**：
- q-21 的测试使用 `skipIf(!infraAvailable)`，在基础设施不可用时全部跳过
- AC-05（索引失败）在 q-21 代码中未实现具体断言，由 q-22 补充验证
