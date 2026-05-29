# Handoff: 测试架构决策与 q-22 创建（2026-05-29）

## 会话概要

作为架构师对 GoferBot 项目测试架构进行全面评估，决策 q-16~q-22 的执行优先级，并创建 q-22 issue。

---

## 发现的问题

### 1. RAG 链路从未真实验证（Critical）

当前 113 个集成测试对 `VectorService`、`KeywordService`、`QueueService`、`StorageService` 全部 Mock：
- `TestAppFactory` 硬编码了 mock 实现（`mockVectorService`、`mockQueueService`、`mockStorageService`）
- `rag-e2e.spec.ts`（q-21）虽有 4 个 AC，但 Milvus/Redis/MinIO 仍是 Mock
- **结果**：RAG 端到端链路（上传→解析→分块→嵌入→索引→检索→回答）从未在真实环境中跑通

### 2. q-21 与 q-22 职责重叠但深度不同

| 维度 | q-21 | q-22 |
|------|------|------|
| 状态 | closed（骨架完成） | open（真实链路） |
| Mock 策略 | Vector/Queue/Storage 仍 Mock | **真实连接 Milvus + Redis + MinIO** |
| AC-03 | 轮询到 ready 即通过 | 需验证 PG Chunk 表和 Milvus 均有数据 |
| AC-04 | 聊天返回 SSE 即通过 | 需验证检索返回候选含 content |

### 3. q-16 实际已完成但未关闭

- `tests/e2e-full/` 已删除
- `playwright.config.ts`、`globalSetup`、`fixtures` 已实现
- **遗留问题**：`webServer` 只配置了前端，后端靠 `globalSetup` 中 `spawn` 启动

### 4. q-17~q-19 测试文件已存在

`tests/e2e/specs/` 和 `tests/e2e/flows/` 下已有大量 `.spec.ts`：
- `auth.spec.ts`、`knowledge-base.spec.ts`（q-17 范围）
- `chat.spec.ts`、`chat-with-rag.spec.ts`、`session-management.spec.ts`（q-18 范围）
- `settings.spec.ts`、`onboarding-journey.spec.ts`（q-19 范围）

**问题**：这些文件是否已覆盖 q-17~q-19 的 AC？需要审查确认。

### 5. 旧版测试文件与当前架构不一致

`tests/integration/rag.test.ts`、`indexSync.test.ts`、`chatRag.test.ts` 使用 SQLite（`vec0`、`fts5`），与当前 PG + Milvus 架构不一致。

---

## 架构决策

### 执行优先级

```
P0: q-22（RAG 真实集成测试）—— 最大技术债务
P1: q-16 收尾（确认 webServer 配置或文档化现有方案）
P2: 审查 q-17~q-19 已有测试文件，确认覆盖度
P3: 清理旧版 SQLite 测试文件（标记 deprecated）
```

### q-22 关键决策

| 决策项 | 决策 | 理由 |
|--------|------|------|
| 测试文件位置 | 新建 `tests/integration/rag-real.spec.ts` | 避免污染 q-21 骨架和旧版 SQLite 测试 |
| `realMode` 实现 | 重构 `TestAppFactory.create(dbUrl, opts?)` | 向后兼容，不新建类避免代码重复 |
| 基础设施检测 | 四服务全检测（PG+Milvus+Redis+MinIO） | q-21 的 DATABASE_URL 检测过于宽松 |
| Embedding API | 继续 Mock | 避免外部网络和费用 |

---

## 已完成的动作

1. **同步 7 个 RAG issue 状态**：d-20/b-10/b-11/b-08/b-09/f-16/q-21 的 `issue.md` 和 `checklist.json` 更新为 closed/passed
2. **创建 q-22 issue**：
   - `docs/issues/q-22-rag-real-integration-tests/issue.md`
   - `docs/issues/q-22-rag-real-integration-tests/checklist.json`
   - `docs/issues/q-22-rag-real-integration-tests/specs/feature-spec.md`
   - `docs/issues/q-22-rag-real-integration-tests/specs/api-spec.md`
3. **更新 BACKLOG.md**：将 q-22 加入"进行中"

---

## 下一步执行顺序

### 阶段 1：q-22 开发（最高优先级）

1. **生成 plan.md** — 使用 `/plan-generator` skill
2. **实现 AC-01**：`tests/integration/helpers/infra-check.ts` — 四服务健康检测
3. **实现 AC-02**：扩展 `TestAppFactory.create(dbUrl, { realMode?: boolean })`
4. **实现 AC-03**：`tests/integration/rag-real.spec.ts` — 索引链路测试
5. **实现 AC-04**：检索链路测试
6. **实现 AC-05**：失败降级测试（zhparser 缺失、Milvus 不可用）
7. **验证 AC-06/07**：type-check + 全部测试通过

### 阶段 2：q-16 收尾

1. 确认 `webServer` 是否需补充后端配置
2. 或文档化 `globalSetup` 启动后端的决策
3. 关闭 q-16

### 阶段 3：q-17~q-19 审查

1. 读取 `tests/e2e/specs/` 下已有文件
2. 对照 q-17~q-19 的 checklist 确认覆盖度
3. 如已覆盖，关闭 issue；如有缺口，补充

### 阶段 4：技术债务清理

1. 标记 `tests/integration/*.test.ts`（SQLite 旧版）为 deprecated
2. 评估是否删除或迁移

---

## 相关文件路径

- q-22 issue: `docs/issues/q-22-rag-real-integration-tests/`
- q-21 issue: `docs/issues/q-21-rag-server-integration-e2e/`
- q-16 issue: `docs/issues/q-16-e2e-infra-migration/`
- 测试指南: `docs/guide/backend/integration-testing-guide.md`
- API 测试指南: `docs/guide/backend/api-testing-guide.md`
- 前端测试指南: `docs/guide/frontend/unit-testing-guide.md`
- TestAppFactory: `tests/integration/helpers/test-app.factory.ts`
- q-21 集成测试: `tests/integration/rag-e2e.spec.ts`
- Playwright 配置: `tests/e2e/playwright.config.ts`
- Playwright globalSetup: `tests/e2e/playwright.global-setup.ts`

---

## 建议的 Skills

- `/plan-generator` — 为 q-22 生成实现计划
- `/dev-orchestrator` — 执行 q-22 开发
- `/kb-review` — 审查已有 E2E 测试文件（q-17~q-19）
- `/issue-lifecycle` — 更新 issue 状态（q-16 收尾、q-17~q-19 审查后关闭）
