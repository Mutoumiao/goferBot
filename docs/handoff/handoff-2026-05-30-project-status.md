# Handoff: GoferBot 项目全局状态与后续路线图（2026-05-30 / 2026-06-01 更新）

> 生成于 2026-05-30，**2026-06-01 更新**反映 ADR 0005（pgvector 替代 Milvus）重大架构变更。
> 涵盖本轮（q-16/q-18/q-19/q-21/q-22 关闭）后的完整项目状态。

---

## 重大架构变更通知（2026-06-01）

**ADR 0005 已接受：pgvector 替代 Milvus**

| 组件 | 旧方案 | 新方案 |
|------|--------|--------|
| 向量存储 | Milvus (Docker 独立服务) | PostgreSQL pgvector 扩展 |
| Docker 服务 | PG + MinIO + Milvus + Redis | PG + MinIO + Redis |
| 向量列位置 | Milvus collection | `chunks.embedding` 列 |
| 事务一致性 | 应用层双写，无事务 | PostgreSQL 原生 ACID |

**影响范围**：
- q-22 测试已更新：移除 Milvus 检测，改为 pgvector 扩展检测
- `docker-compose.dev.yml` 待更新：移除 milvus 服务，postgres 改用 `pgvector/pgvector:pg16`
- Prisma Schema 待更新：`Chunk` 模型添加 `embedding` 列，移除 `milvusId`
- 向量服务待重写：`VectorService` 从 Milvus 客户端改为 pgvector 原始 SQL

---

## 一、本轮完成总结

### 已关闭 Issue（5 个）

| Issue | 轨道 | 核心交付 | 验证状态 |
|-------|------|----------|----------|
| **q-16** | quality | E2E 基础设施重构收尾：后端进程 PID 记录与清理 | ✅ 代码已合并 |
| **q-18** | quality | E2E 聊天 SSE 流式响应 + 会话管理 | ✅ 20/20 AC 覆盖 |
| **q-19** | quality | E2E 设置持久化 + 跨模块用户旅程 | ✅ 15/15 AC 覆盖 |
| **q-21** | quality | RAG Server E2E 骨架（4 AC） | ✅ 骨架完成，真实验证由 q-22 覆盖 |
| **q-22** | quality | **RAG 真实集成测试**（7 AC） | ✅ 代码实现完成，已适配 pgvector |

### 关键代码交付

```
tests/integration/helpers/infra-check.ts          # 新增 — 三服务 + pgvector 检测
tests/integration/helpers/test-app.factory.ts     # 修改 — 扩展 realMode 参数
tests/integration/rag-real.spec.ts                # 新增 — 真实 RAG 集成测试（pgvector 版）
docs/issues/q-22-rag-real-integration-tests/plan.md # 新增 — q-22 实现计划
tests/e2e/playwright.global-setup.ts              # 修改 — PID 记录
tests/e2e/playwright.global-teardown.ts           # 修改 — 后端进程清理
```

### 提交记录

```
80a610b docs(handoff): 添加 2026-05-30 项目全局状态交接文档
f739fca docs: 同步 BACKLOG/CHANGELOG，更新 q-17/q-21 状态
f39bc04 docs: 关闭 q-16/q-18/q-19，E2E 基础设施收尾
67821ce test(q-22): RAG 真实集成测试 — 四服务检测 + realMode + 索引/检索/降级链路
```

---

## 二、项目当前全局状态

### 2.1 Issue 状态总览

| 状态 | 数量 | Issue 列表 |
|------|------|------------|
| **open** | **1** | q-17 |
| closed | 26 | f-08~f-16, b-02~b-11, d-11~d-20, i-01, q-16, q-18, q-19, q-21, q-22 |

**当前唯一 open issue：q-17**
- 状态：open，阻塞已解除（q-16 已关闭）
- 已通过：11/16 AC（UI 行为层面，使用 mock API）
- pending：5/16 AC（AC-06, AC-08, AC-12, AC-15, AC-16）
- 技术债务：当前测试使用 mock API，与 spec 要求的"真实后端 API"冲突

### 2.2 测试金字塔（经实际运行验证）

```
        /\
       /  \     E2E (11 files) — Playwright，验证用户旅程
      /----\
     /      \   Integration (1 active + 4 broken + 5 legacy) — Vitest
    /--------\
   /          \ Unit (14 files) — Vitest，验证单模块逻辑
  /------------\
```

| 层级 | 文件数 | 说明 | 运行状态 |
|------|--------|------|----------|
| **E2E** | 11 | `tests/e2e/specs/` (7) + `tests/e2e/flows/` (4) | ✅ 正常（Playwright） |
| **Integration** | **1 active** | `rag-real.spec.ts` | ✅ 正常（基础设施不可用时跳过） |
| | **3 broken** | `auth-flow.spec.ts`, `infra.spec.ts`, `kb-lifecycle.spec.ts` | ❌ Playwright/vitest 语法冲突 |
| | **1 broken** | `rag-e2e.spec.ts` | ❌ 缺少 `./teardown.js` 模块 |
| | **5 legacy** | `tests/integration/sidecar/` | ⚠️ 与当前架构无关 |
| **Unit** | 14 | 后端服务测试 + 前端组件测试 | ✅ 133/133 通过 |

> **重要发现**：集成测试层实际上只有 `rag-real.spec.ts` 能正常运行。其他 4 个文件存在严重问题。

### 2.3 技术债务清单（2026-06-01 更新）

| 优先级 | 项目 | 位置 | 影响 | 建议处理 |
|--------|------|------|------|----------|
| **P0** | **ADR 0005 实施：pgvector 替代 Milvus** | `docker-compose.dev.yml`, `prisma/schema.prisma`, `VectorService` | **高** — 架构变更 | 见"后续路线图"阶段 0 |
| **P0** | **集成测试层 4 个文件无法运行** | `tests/integration/`（除 rag-real 外）| **高** — 集成测试几乎不可用 | 修复或移除 |
| P1 | q-17 mock → 真实 API 重写 | `tests/e2e/specs/auth.spec.ts`, `knowledge-base.spec.ts` | 中 — spec 与实现冲突 | 调整 spec 或重写 |
| P2 | sidecar/ 遗留测试清理 | `tests/integration/sidecar/` | 中 — 5 个无关文件 | 删除或归档 |
| P2 | SQLite 旧版测试标记 | `tests/integration/*.test.ts` | 低 — 与 PG+Milvus 架构不一致 | 添加 deprecated 注释 |
| P3 | HybridRetriever chunk 占位值 | `packages/rag-sdk/src/runtime/hybrid-retriever.ts:52` | 低 — 1 处 TODO | 确认后修复 |

### 2.4 基础设施状态

| 组件 | 状态 | 备注 |
|------|------|------|
| Docker Compose | ⚠️ 待更新 | 需移除 milvus 服务，postgres 改用 `pgvector/pgvector:pg16` |
| 环境变量模板 | ⚠️ 待更新 | 需移除 `MILVUS_*` 变量 |
| PostgreSQL | ⚠️ 需启动 | Docker 未运行时跳过 |
| pgvector 扩展 | ⚠️ 待安装 | 新 PostgreSQL 镜像已包含，旧镜像需手动安装 |
| Redis | ⚠️ 需启动 | Docker 未运行时跳过 |
| MinIO | ⚠️ 需启动 | Docker 未运行时跳过 |

---

## 三、后续路线图

### 阶段 0：ADR 0005 实施（紧急，P0）

**目标**：将向量存储从 Milvus 迁移至 PostgreSQL pgvector。

**任务清单**：

1. **更新 Docker Compose**
   - 移除 `milvus` 服务
   - `postgres` 镜像改为 `pgvector/pgvector:pg16`
   - 更新 `.env.example` 和 `.env.e2e`，移除 `MILVUS_*` 变量

2. **更新 Prisma Schema**
   - `Chunk` 模型：添加 `embedding Unsupported("vector(1536)")?`，移除 `milvusId`
   - 生成迁移文件

3. **重写 VectorService**
   - 删除 `packages/server/src/vector/milvus.ts`
   - 新增 `packages/server/src/vector/pgvector.ts`
   - 重写 `VectorService`：使用 `$queryRaw` 执行向量操作

4. **更新 Indexer**
   - `PrismaMilvusIndexer` → `PrismaVectorIndexer`
   - 单事务写入：PG chunks 表 + embedding 列

5. **更新测试**
   - q-22 已完成适配（本轮已更新）
   - 其他测试按需调整

**工作量**：中（2~3 天）
**风险**：Prisma `Unsupported()` 类型限制，需用 `$queryRaw` 操作向量列

### 阶段 1：修复集成测试层（P0）

**问题**：集成测试层 4/5 文件无法运行。

**方案 A（推荐）：修复 broken 文件**
- `auth-flow.spec.ts` / `infra.spec.ts` / `kb-lifecycle.spec.ts`：Playwright → vitest 语法转换
- `rag-e2e.spec.ts`：补充缺失的 `teardown.js` 或调整导入路径
- 工作量：中（1~2 天）

**方案 B：移除 broken 文件**
- 直接删除 4 个无法运行的文件
- 工作量：小（1 小时）

### 阶段 2：q-17 收尾

**方案 A（推荐）**：调整 spec，承认 mock 测试在 E2E 层的价值。
**方案 B**：重写为真实 API 测试。

### 阶段 3：技术债务清理

- sidecar/ 删除
- SQLite 旧版标记 deprecated
- hybrid-retriever.ts TODO 修复

### 阶段 4：CI 强化与新功能开发

- CI 流程加入 `pnpm infra:up`
- q-22 独立 CI job
- 新功能开发（PDF 支持、多 KB 联合检索等）

---

## 四、架构决策记录

### 决策 1：ADR 0005 pgvector 替代 Milvus

**背景**：Milvus 存在双写无事务、冗余服务、网络往返、运维负担等问题。

**决策**：将向量存储迁移至 PostgreSQL pgvector 扩展。

**理由**：
1. 事务一致性：元数据与向量在同一 PostgreSQL 事务中写入
2. 运维简化：移除 Milvus 容器，Docker Compose 服务从 4 个减至 3 个
3. 查询简化：向量搜索 + 内容获取单次 SQL 完成
4. 数据规模匹配：本项目定位个人/小团队，单用户文档量数千到数万，pgvector 足够

**风险**：千万级+ 性能劣于 Milvus，未来超大规模需重新评估。

### 决策 2：集成测试层 broken 文件的处置

**决策**：修复而非删除。

### 决策 3：q-17 mock 测试的处置

**决策**：承认 mock 测试在 E2E 层的价值，真实 API 验证由集成测试层覆盖。

### 决策 4：q-21 不 reopened

**决策**：保持 closed，真实验证由 q-22 覆盖。

### 决策 5：TestAppFactory realMode 扩展

**决策**：新增 `realMode?: boolean` 参数，而非创建新类。

---

## 五、关键文件索引

### 已适配 pgvector 的文件

| 文件 | 说明 | 状态 |
|------|------|------|
| `tests/integration/helpers/infra-check.ts` | 三服务 + pgvector 扩展检测 | ✅ 已更新 |
| `tests/integration/rag-real.spec.ts` | 真实 RAG 集成测试（pgvector 版）| ✅ 已更新 |
| `docs/issues/q-22-rag-real-integration-tests/specs/feature-spec.md` | q-22 功能规格 | ✅ 已更新 |
| `docs/issues/q-22-rag-real-integration-tests/specs/api-spec.md` | q-22 API 规格 | ✅ 已更新 |

### 待适配 pgvector 的文件

| 文件 | 说明 | 状态 |
|------|------|------|
| `docker-compose.dev.yml` | Docker 基础设施 | ⚠️ 待更新 |
| `packages/server/prisma/schema.prisma` | 数据库模型 | ⚠️ 待更新 |
| `packages/server/src/vector/milvus.ts` | Milvus 客户端 | ⚠️ 待删除 |
| `packages/server/src/vector/pgvector.ts` | pgvector 客户端 | ⚠️ 待新增 |
| `packages/server/src/processors/vector/vector.service.ts` | 向量服务 | ⚠️ 待重写 |
| `packages/server/src/processors/indexing/prisma-milvus.indexer.ts` | 索引器 | ⚠️ 待重写 |
| `.env.example` | 环境变量模板 | ⚠️ 待更新 |

### 测试文件状态

#### ✅ 正常运行

| 文件 | 覆盖 AC | 说明 |
|------|---------|------|
| `tests/integration/rag-real.spec.ts` | q-22 AC-03~AC-05 | 真实 RAG 集成测试（pgvector） |
| `tests/e2e/flows/chat-with-rag.spec.ts` | q-18 AC-01~AC-08b | SSE 聊天 + KB 选择 |
| `tests/e2e/flows/session-management.spec.ts` | q-18 AC-09~AC-19 | 会话标签 + 历史管理 |
| `tests/e2e/flows/settings-persist.spec.ts` | q-19 AC-01~AC-07,14~15 | 设置保存与恢复 |
| `tests/e2e/flows/onboarding-journey.spec.ts` | q-19 AC-08~AC-13 | 新用户完整旅程 |
| `tests/e2e/specs/auth.spec.ts` | q-17 AC-01~AC-05,07 | 认证流程（mock） |
| `tests/e2e/specs/knowledge-base.spec.ts` | q-17 AC-09~AC-11,13~14 | KB 生命周期（mock） |

#### ❌ 无法运行（需修复）

| 文件 | 问题 | 建议修复 |
|------|------|----------|
| `tests/integration/auth-flow.spec.ts` | Playwright `test.describe()` 在 vitest 下报错 | 改为 vitest `describe()` |
| `tests/integration/infra.spec.ts` | Playwright `test.describe()` 在 vitest 下报错 | 改为 vitest `describe()` |
| `tests/integration/kb-lifecycle.spec.ts` | Playwright `test.describe()` 在 vitest 下报错 | 改为 vitest `describe()` |
| `tests/integration/rag-e2e.spec.ts` | 缺少 `./teardown.js` 模块 | 补充模块或调整导入 |

#### ⚠️ 遗留（待清理）

| 文件 | 说明 |
|------|------|
| `tests/integration/sidecar/*.spec.ts` | 5 个文件，与当前架构无关 |

---

## 六、风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| **ADR 0005 实施影响现有功能** | 中 | **高** | 分步骤实施：Docker → Schema → Service → Indexer → 测试 |
| **集成测试层 4 个文件无法运行** | **已发生** | **高** | 阶段 1 修复：语法转换 + 补充缺失模块 |
| **Prisma Unsupported() 维护成本** | 中 | 中 | 向量操作封装在 VectorService 内，调用方无感知 |
| **千万级+ 向量性能不足** | 低 | 中 | 当前数据量数万级；如增长超预期，可迁移到专用向量库 |
| q-22 真实测试在 CI 中不稳定 | 中 | 高 | 独立 CI job + 基础设施健康检测 + 优雅跳过 |
| q-17 mock/真实冲突未解决 | 高 | 中 | 阶段 2 处理：调整 spec 或重写 |

---

## 七、立即行动项

### 本周可完成（按优先级排序）

1. **实施 ADR 0005：pgvector 替代 Milvus（P0）**
   - 更新 `docker-compose.dev.yml`：移除 milvus，postgres 改用 pgvector 镜像
   - 更新 Prisma Schema：添加 `embedding` 列，移除 `milvusId`
   - 重写 `VectorService`：pgvector 原始 SQL 封装
   - 重写 `PrismaMilvusIndexer`：单事务写入
   - 更新 `.env.example`：移除 `MILVUS_*` 变量
   - 验证：`pnpm type-check` + `npx vitest run tests/unit` 全部通过

2. **修复集成测试层 broken 文件（P0）**
   - `auth-flow.spec.ts` / `infra.spec.ts` / `kb-lifecycle.spec.ts`：Playwright → vitest
   - `rag-e2e.spec.ts`：补充 `teardown.js`
   - 验证：`npx vitest run --config vitest.integration.config.ts` 全部通过

3. **验证 q-22 真实运行**
   - 启动 Docker：`pnpm infra:up`
   - 运行集成测试，确认 `rag-real.spec.ts` 3 个 AC 全部通过（非跳过）

### 下周规划

1. **关闭 q-17**
2. **技术债务清理**：sidecar/ 删除、SQLite 旧版标记 deprecated
3. **CI 配置**：为 q-22 添加独立 CI job
4. **新功能开发**：基于当前测试基础设施，启动下一个功能迭代

---

## 八、验证清单

在继续下一阶段前，请确认以下事项：

- [ ] ADR 0005 实施完成（pgvector 替代 Milvus）
- [ ] `docker-compose.dev.yml` 可正常启动（`pnpm infra:up`）
- [ ] Prisma 迁移已应用（`prisma migrate deploy`）
- [ ] 集成测试层所有文件可正常运行
- [ ] q-22 真实测试在 Docker 环境下通过（非跳过）
- [ ] q-17 已关闭或明确处理方案
- [ ] sidecar/ 遗留测试已清理
- [ ] CI 流程包含集成测试步骤

---

## 九、附录：测试运行命令速查

```bash
# 单元测试
npx vitest run tests/unit

# 集成测试（含 q-22 真实链路）
npx vitest run --config vitest.integration.config.ts

# E2E 测试
pnpm test:e2e

# 全部测试
pnpm test:all

# 类型检查
pnpm type-check

# 启动基础设施
pnpm infra:up

# 停止基础设施
pnpm infra:down
```

---

## 十、附录：本轮关键发现

### 发现 1：ADR 0005 重大架构变更

**时间**：2026-06-01
**内容**：接受 pgvector 替代 Milvus。
**影响**：Docker 服务减少 1 个，事务一致性提升，但需重写 VectorService 和 Indexer。
**状态**：q-22 测试已适配，其他代码待实施。

### 发现 2：集成测试层比预期更脆弱

**初始假设**：4 active + 5 legacy
**实际验证**：1 active + 4 broken + 5 legacy
**应对措施**：已将修复集成测试层提升为 P0 优先级。

### 发现 3：q-22 的真实验证尚未完成

**状态**：代码已实现，但真实链路尚未在 Docker 环境中验证。
**风险**：如果 Docker 环境中存在未预料的问题，可能需要回滚修改。
**应对措施**：列入立即行动项第 3 条。

---

*本文档由架构师生成于 2026-05-30，2026-06-01 更新反映 ADR 0005 架构变更。作为本轮（q-16/q-18/q-19/q-21/q-22）关闭后的全局状态交接。*
