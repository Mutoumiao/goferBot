---
issue_id: q-03-v1-cleanup
type: feature-spec
status: approved
summary: 清理 V1 废弃代码：删除 sync.ts/rag.ts/embedding.ts，清空保留 db.ts/indexer.ts 框架，移除 better-sqlite3 等依赖，路由保留框架返回 501。范围外排除仍使用的 llm.ts。
---
# Feature Spec: V1 架构废弃代码清理

## 用户故事

- 作为开发者，我希望仓库中不再残留 V1 废弃代码，以免新成员误用旧机制（SQLite 本地存储、物理文件夹同步、sqlite-vec 索引）。
- 作为开发者，我希望 `pnpm install` 不再触发 `better-sqlite3` 原生模块编译，减少安装时间和构建失败风险。
- 作为开发者，我希望 `db.ts` 和 `indexer.ts` 保留文件框架并带有明确的占位标记，以便 Phase 5 重写时知道从哪里开始。

## 范围内（In Scope）

| 文件/目录 | 操作 | 说明 |
|-----------|------|------|
| `packages/server/src/sync.ts` | **删除** | V1 物理文件夹同步逻辑，V2 使用虚拟文件夹 |
| `packages/server/src/services/indexer.ts` | **清空保留** | 删除 sqlite-vec / FTS5 实现，保留空文件框架供 Phase 5 重写 |
| `packages/server/src/services/rag.ts` | **删除** | V1 RAG 实现（sqlite-vec + FTS5 混合搜索），V2 由 RAG SDK 替代 |
| `packages/server/src/services/embedding.ts` | **删除** | V1 直接调用 embedding API，V2 由 RAG SDK 抽象 |
| `packages/server/src/db.ts` | **清空保留** | 删除 better-sqlite3 初始化 + schema，保留空文件并标记"待 Drizzle 替换" |
| `packages/server/src/utils.ts` | **部分删除** | 删除仅 V1 使用的 `getAppDataDir()`；保留其他仍在使用的工具函数（如有） |
| `packages/server/package.json` | **移除依赖** | 移除 `better-sqlite3`、`sqlite-vec`、`@types/better-sqlite3`、`@langchain/textsplitters`、`langchain` |
| `packages/server/src/routes/knowledgeBases.ts` | **清理引用** | 移除对 `db`、`utils`、`indexer` 的 V1 引用，保留路由框架（返回 501 或空实现） |
| `packages/server/src/routes/sessions.ts` | **清理引用** | 移除对 `db` 的 V1 引用，保留路由框架 |
| `packages/server/src/routes/chat.ts` | **清理引用** | 移除对 `db`、`rag`、`embedding` 的 V1 引用，保留路由框架 |
| `packages/server/src/routes/settings.ts` | **清理引用** | 移除对 `utils` 的 V1 引用，保留路由框架 |
| 工作区 `.sidecar-port` 文件 | **删除** | 若存在则删除（gitignore 已处理） |
| `CLAUDE.md` | **更新引用** | 若存在对 `shellAdapters` / `backendAdapters` 的过时描述则修正 |
| `docs/01-prd/v2-cloud-native.md` | **更新描述** | 若 Sidecar / Tauri 描述与最新 ADR 冲突则修正 |

## 范围外（Out of Scope）

- `packages/server/src/services/llm.ts` — 仍在使用，属于 `b-04-chat-sse-api`
- `packages/server/src/routes/*.ts` 的完整重写 — 由各功能 issue 负责
- `src-tauri/` 目录的删除 — 按冻结政策保留
- `packages/webui/` 前端代码清理 — 不在本 issue 范围

## 涉及文件清单

### 删除文件
- `packages/server/src/sync.ts`
- `packages/server/src/services/rag.ts`
- `packages/server/src/services/embedding.ts`

### 保留框架但清空内容
- `packages/server/src/db.ts`
- `packages/server/src/services/indexer.ts`

### 修改文件
- `packages/server/src/utils.ts`
- `packages/server/src/index.ts`（如有 import 需清理）
- `packages/server/src/routes/knowledgeBases.ts`
- `packages/server/src/routes/sessions.ts`
- `packages/server/src/routes/chat.ts`
- `packages/server/src/routes/settings.ts`
- `packages/server/package.json`
- `CLAUDE.md`
- `docs/01-prd/v2-cloud-native.md`

## 已做决策表

| 决策 | 选择 | 理由 |
|------|------|------|
| `db.ts` 删除还是保留？ | 保留空文件 | 后续 i-02-drizzle-orm-setup 会在此文件位置建立 Drizzle 客户端，保留文件路径减少冲突 |
| `indexer.ts` 删除还是保留？ | 保留空文件 | Phase 5 RAG 集成需要在此重建索引服务，保留文件框架作为占位 |
| `utils.ts` 全删还是部分删？ | 部分删除 | `getAppDataDir()` 仅 V1 使用（db、sync、settings、embedding 均依赖它），V2 无本地数据目录概念；若还有其他函数被 V2 代码使用则保留 |
| routes 怎么处理？ | 保留框架，移除 V1 实现 | 各功能 issue（b-04、f-06 等）会重写路由，本 issue 只负责切断 V1 依赖，避免编译错误 |
| `langchain` / `@langchain/textsplitters` 是否移除？ | 是 | 仅 `indexer.ts` 使用，V2 RAG SDK 会自行决定解析库 |
| `nanoid` 是否保留？ | 是 | 路由代码仍在使用，且 V2 仍需生成 ID |
| `@hono/node-server` / `hono` 是否保留？ | 是 | V2 核心框架 |
| `prebuild-install` 是否保留？ | 是 | 虽然与 better-sqlite3 构建相关，但属于通用 dev 工具，暂不删除 |

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 误删 V2 代码 | 清理前全局搜索 import 关系，确认无 V2 文件依赖目标代码后再删除 |
| routes 清理后编译失败 | 保留路由框架，仅替换实现为 `return c.json({ error: 'Not implemented' }, 501)` |
| 依赖移除后 `pnpm-lock.yaml` 残留 | 执行 `pnpm install` 刷新 lock 文件并验证 |
| `.sidecar-port` 文件散落在子目录 | 全局搜索 `find . -name ".sidecar-port"` 确认清理 |
