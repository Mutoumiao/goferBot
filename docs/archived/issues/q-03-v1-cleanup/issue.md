---
id: q-03-v1-cleanup
type: issue
status: closed
track: quality
priority: p0
summary: 清理 V1 架构遗留的废弃代码（SQLite、sync、sidecar 相关），减少技术债务。避免后续开发者误用旧机制。
blocked_by: []
blocks: []
spec: docs/03-specs/q-03-v1-cleanup/
plan: docs/04-plans/q-03-v1-cleanup/v1.md
tests: docs/08-test-cases/q-03-v1-cleanup/
token_estimate: 1300
---

状态: closed
分类: enhancement

## 要构建的内容

清理 V1 架构遗留的废弃代码，减少技术债务，避免后续开发者误用旧机制。

## 背景

ADR-0004 架构改革后，以下 V1 代码已废弃但仍在仓库中：

| 文件/目录                                                          | V1 用途                      | V2 替代方案                | 风险（不清理）        |
|--------------------------------------------------------------------|------------------------------|----------------------------|-----------------------|
| `packages/server/src/db.ts`                                        | better-sqlite3 + 内联 schema | Drizzle ORM + PostgreSQL   | 新开发者可能误用旧 DB |
| `packages/server/src/sync.ts`                                      | 物理文件夹同步到 DB          | 虚拟文件夹（数据库树结构） | 启动时意外执行同步    |
| `packages/server/src/services/indexer.ts`                          | sqlite-vec / FTS5 索引       | Milvus + BullMQ            | 构建依赖 sqlite-vec   |
| `packages/server/src/services/embedding.ts`                        | 直接调用 embedding API       | 通过 RAG SDK 抽象          | 代码路径分散          |
| `packages/server/src/services/rag.ts`                              | V1 RAG 实现                  | Phase 5 新实现             | 与旧 schema 耦合      |
| `packages/server/src/utils.ts`                                     | `getAppDataDir()` 等本地工具 | 不再需要                   | 无直接风险            |
| `packages/server/package.json` 中的 `better-sqlite3`、`sqlite-vec` | V1 数据库依赖                | `drizzle-orm`、`pg`        | 安装时间、构建问题    |
| `.sidecar-port` 文件（若存在）                                     | Sidecar 端口发现             | 固定端口 `PORT`            | 无直接风险            |

## 验收标准

### Server 端清理
- [ ] 删除 `packages/server/src/sync.ts` 及所有引用
- [ ] 删除 `packages/server/src/services/indexer.ts` 中的 sqlite-vec / FTS5 逻辑（保留文件框架供 Phase 5 重写）
- [ ] 从 `packages/server/package.json` 移除 `better-sqlite3`、`sqlite-vec` 依赖
- [ ] 从 `packages/server/package.json` 移除 `@types/better-sqlite3` devDependency
- [ ] 清理 `packages/server/src/db.ts`：保留文件但删除 better-sqlite3 初始化代码，标记为"待 Drizzle 替换"
- [ ] 删除 `packages/server/src/utils.ts` 中仅 V1 使用的函数（如 `getAppDataDir`）
- [ ] 确保 `pnpm dev:server` 仍能正常启动（当前 Hono 服务不依赖这些文件）

### 全局清理
- [ ] 删除工作区中任何 `.sidecar-port` 文件（gitignore 已处理，但需确认）
- [ ] 更新 `CLAUDE.md` 中关于 `shellAdapters` / `backendAdapters` 的引用（若存在）
- [ ] 更新 `docs/prd/v2-cloud-native.md` 中关于 Sidecar / Tauri 的描述（若与最新 ADR 冲突）

### 验证
- [x] `pnpm install` 后无 better-sqlite3 原生构建
- [x] `pnpm dev:server` 正常启动
- [x] `pnpm dev:web` 正常启动
- [x] `pnpm type-check` 通过

## 阻塞于

- 无（清理工作可独立进行，但建议在 i-02-drizzle-orm-setup 启动前完成，避免新旧 DB 代码并存）

## 范围外

- `packages/server/src/services/llm.ts` 的清理（仍在使用，属于 b-04-chat-sse-api）
- `packages/server/src/routes/*.ts` 的重写（由各功能 issue 负责）
- `src-tauri/` 目录的删除（按冻结政策保留）

## Agent 简报

**分类：** enhancement
**摘要：** 清理 V1 废弃代码（SQLite、sync、sidecar 相关），减少技术债务

**当前行为：**
仓库中残留大量 V1 代码（better-sqlite3、sync.ts、sqlite-vec 依赖），新开发者容易混淆。

**期望行为：**
V1 废弃代码清理完毕，Server 端仅剩 Hono 路由框架和 V2 所需依赖。

**关键接口：**
- `packages/server/src/sync.ts` — 删除
- `packages/server/src/db.ts` — 清理标记
- `packages/server/package.json` — 移除依赖

**验收标准：**
- [x] sync.ts 删除
- [x] sqlite-vec / better-sqlite3 依赖移除
- [x] db.ts 清理标记
- [x] utils.ts V1 函数删除
- [x] .sidecar-port 清理
- [x] 文档更新
- [x] dev:server / dev:web / type-check 通过

**范围外：**
- llm.ts 清理
- routes 重写
- src-tauri 删除
