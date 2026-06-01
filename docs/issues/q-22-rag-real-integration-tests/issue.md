---
id: q-22
status: closed
track: quality
priority: p1
summary: RAG 真实集成测试（索引+检索端到端链路验证）
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

建立 RAG 核心链路的真实集成测试，在真实基础设施（PostgreSQL + Milvus + Redis + MinIO）上验证端到端行为，消除当前 Mock 过重导致的"假集成"风险。

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

### 为什么现在做

当前 113 个集成测试对 VectorService、KeywordService、QueueService、StorageService 全部 Mock，RAG 端到端链路从未在真实环境中验证。这是最大的技术债务。

### 测试策略

采用"渐进式真实化"：
1. 新增独立测试文件，不破坏现有 Mock 测试（保持快速/稳定）
2. 通过 `globalSetup` 检测基础设施可用性，不可用时优雅跳过
3. 复用现有 `TestAppFactory` + `TestDatabaseManager`，扩展真实模式

### 验证范围

**索引链路**：上传 → 解析 → 分块 → 嵌入 → 写入 PG + Milvus → 状态变为 ready
**检索链路**：查询 → 向量检索 → 关键词检索 → RRF 融合 → 后处理 → 返回带 content 的候选

### 阻塞关系

- q-21 提供 E2E 测试骨架和基础设施检测模式，本 issue 复用其策略
