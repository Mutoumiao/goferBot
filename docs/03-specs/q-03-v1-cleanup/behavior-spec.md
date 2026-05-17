---
issue_id: q-03-v1-cleanup
type: behavior-spec
status: approved
summary: 定义4步清理依赖拓扑（叶子文件→中间层→路由→依赖），安全边界为不误删 V2 代码、保留文件框架标记、路由编译通过返回 501、依赖彻底移除并同步 lock 文件。
---
# Behavior Spec: V1 架构废弃代码清理 — 安全边界与验证

## 安全边界原则

1. **绝不误删 V2 代码**：任何删除操作前必须通过静态 import 分析确认目标代码无 V2 引用。
2. **保留文件框架**：`db.ts`、`indexer.ts` 保留空文件并添加 `// TODO(Phase X): 待重写` 标记，避免后续 issue 找不到插入点。
3. **路由不中断**：清理后的路由文件必须能编译通过，运行时返回 501（Not Implemented）而非 500 或崩溃。
4. **依赖清理彻底**：`package.json` 移除后必须验证 `node_modules` 中不再存在对应包，且 `pnpm-lock.yaml` 同步更新。

## 清理顺序（依赖拓扑）

```
Step 1: 删除叶子文件（无其他文件依赖它们）
  ├── embedding.ts（仅被 indexer.ts、rag.ts、chat.ts 依赖）
  ├── rag.ts（仅被 chat.ts 依赖）
  └── sync.ts（仅被外部调用，无内部引用）

Step 2: 删除/清空中间层文件（其依赖已清理）
  ├── indexer.ts（依赖 db.ts、embedding.ts；被 knowledgeBases.ts 依赖）
  ├── db.ts（依赖 utils.ts；被多文件依赖）
  └── utils.ts 中的 getAppDataDir（被 db.ts、sync.ts、settings.ts、embedding.ts 依赖）

Step 3: 修改路由文件（切断对 Step 1/2 的引用）
  ├── knowledgeBases.ts（引用 db、utils、indexer）
  ├── sessions.ts（引用 db）
  ├── chat.ts（引用 db、rag、embedding）
  └── settings.ts（引用 utils）

Step 4: 更新 package.json 并重新安装依赖

Step 5: 全局清理与文档更新
  ├── .sidecar-port 文件
  ├── CLAUDE.md
  └── docs/01-prd/v2-cloud-native.md
```

## 各文件清理行为详述

### 1. `packages/server/src/sync.ts`

- **行为**：物理删除文件。
- **安全验证**：全局搜索 `import.*sync` 确认无其他文件引用。
- **验证命令**：
  ```bash
  grep -r "from './sync.js'" packages/server/src/ || echo "No references"
  ```

### 2. `packages/server/src/services/embedding.ts`

- **行为**：物理删除文件。
- **安全验证**：确认仅 `indexer.ts`、`rag.ts`、`chat.ts` 引用。Step 1 执行时这些文件尚未清理，但已知它们同属 V1，可安全删除。
- **验证命令**：
  ```bash
  grep -r "from './embedding.js'\|from '../services/embedding.js'" packages/server/src/
  ```

### 3. `packages/server/src/services/rag.ts`

- **行为**：物理删除文件。
- **安全验证**：确认仅 `chat.ts` 引用（`import { hybridSearch, buildRagPrompt } from '../services/rag.js'`）。
- **验证命令**：
  ```bash
  grep -r "from './rag.js'\|from '../services/rag.js'" packages/server/src/
  ```

### 4. `packages/server/src/services/indexer.ts`

- **行为**：清空文件内容，保留文件框架。
- **保留内容**：
  ```typescript
  // TODO(Phase 5): 重建索引服务 — Milvus + BullMQ 异步流水线
  // 旧实现（sqlite-vec / FTS5）已清理，见 issue q-03-v1-cleanup
  ```
- **安全验证**：确认 `knowledgeBases.ts` 中所有 `await import('../services/indexer.js')` 调用点。由于路由将在 Step 3 中移除这些调用，indexer.ts 本身可提前清空。
- **验证命令**：
  ```bash
  grep -n "indexer.js" packages/server/src/routes/knowledgeBases.ts
  ```

### 5. `packages/server/src/db.ts`

- **行为**：删除所有 better-sqlite3 初始化、schema 定义、迁移逻辑、向量扩展加载。保留空文件框架。
- **保留内容**：
  ```typescript
  // TODO(i-02): 待 Drizzle ORM + PostgreSQL 替换
  // 旧实现（better-sqlite3）已清理，见 issue q-03-v1-cleanup
  ```
- **安全验证**：确认 `db.ts` 被以下文件引用，这些文件均将在 Step 3 中清理引用：
  - `routes/knowledgeBases.ts`
  - `routes/sessions.ts`
  - `routes/chat.ts`
  - `services/indexer.ts`（已清空）
  - `services/rag.ts`（已删除）
- **验证命令**：
  ```bash
  grep -r "from '../db.js'\|from './db.js'" packages/server/src/
  ```

### 6. `packages/server/src/utils.ts`

- **行为**：删除 `getAppDataDir()` 函数及其 import（`fs`, `path`, `os` 若不再被其他函数使用则一并删除）。
- **安全验证**：
  - `getAppDataDir` 被 `db.ts`、`sync.ts`、`settings.ts`、`embedding.ts` 使用。
  - `sync.ts` 和 `embedding.ts` 已删除；`db.ts` 已清空；仅剩 `settings.ts` 需要处理。
  - `settings.ts` 在 Step 3 中需移除 `getAppDataDir` 引用，改用其他配置存储方式（或暂时返回静态默认值）。
- **验证命令**：
  ```bash
  grep -r "getAppDataDir" packages/server/src/
  ```

### 7. `packages/server/src/routes/*.ts`

- **行为**：移除所有 V1 import（`db`, `utils`, `rag`, `embedding`, `indexer`），保留 Hono 路由框架。将涉及旧数据库操作的 handler 替换为 501 响应。
- **示例行为**：
  ```typescript
  app.get('/', (c) => c.json({ error: 'Not implemented' }, 501))
  ```
- **安全验证**：确保不删除 `hono` 相关 import 和类型定义。

### 8. `packages/server/package.json`

- **行为**：从 `dependencies` 移除 `better-sqlite3`、`sqlite-vec`、`langchain`、`@langchain/textsplitters`；从 `devDependencies` 移除 `@types/better-sqlite3`。
- **安全验证**：确认 `nanoid`、`hono`、`@hono/node-server` 仍被使用，予以保留。
- **验证命令**：
  ```bash
  cd packages/server && pnpm install
  ls node_modules | grep -E "better-sqlite3|sqlite-vec|langchain" || echo "Clean"
  ```

### 9. 全局 `.sidecar-port` 清理

- **行为**：删除工作区中任何 `.sidecar-port` 文件。
- **验证命令**：
  ```bash
  find . -name ".sidecar-port" -type f
  ```
  期望输出为空。

### 10. 文档更新

- **CLAUDE.md**：若存在对 `shellAdapters` / `backendAdapters` 的过时描述，更新为当前架构描述。
- **docs/01-prd/v2-cloud-native.md**：若 Sidecar / Tauri 描述与 ADR-0004 冲突，修正为一致。
- **验证命令**：
  ```bash
  grep -n "sidecar\|shellAdapters\|backendAdapters" CLAUDE.md docs/01-prd/v2-cloud-native.md
  ```

## 验证清单（Checklist）

| # | 验证项 | 命令 | 期望结果 |
|---|--------|------|----------|
| 1 | 无 better-sqlite3 原生构建 | `pnpm install` | 不出现 `prebuild-install` / `node-gyp` 编译日志 |
| 2 | Server 启动正常 | `pnpm dev:server` | Hono 服务启动，监听端口，无报错 |
| 3 | Web 启动正常 | `pnpm dev:web` | Vite 开发服务器启动，无编译错误 |
| 4 | 类型检查通过 | `pnpm type-check` | `tsc --noEmit` 0 错误 |
| 5 | sync.ts 已删除 | `ls packages/server/src/sync.ts` | 文件不存在 |
| 6 | rag.ts 已删除 | `ls packages/server/src/services/rag.ts` | 文件不存在 |
| 7 | embedding.ts 已删除 | `ls packages/server/src/services/embedding.ts` | 文件不存在 |
| 8 | db.ts 已标记 | `head -2 packages/server/src/db.ts` | 包含 TODO(i-02) 标记 |
| 9 | indexer.ts 已标记 | `head -2 packages/server/src/services/indexer.ts` | 包含 TODO(Phase 5) 标记 |
| 10 | 无 `.sidecar-port` 残留 | `find . -name ".sidecar-port" -type f` | 空结果 |
| 11 | package.json 无旧依赖 | `grep -E "better-sqlite3|sqlite-vec|langchain" packages/server/package.json` | 空结果 |

## 回滚策略

若清理后发现遗漏依赖或编译失败：
1. 从 git 恢复单个文件：`git checkout HEAD -- <file>`
2. 若依赖已移除，从 git 恢复 `package.json` 并重新 `pnpm install`
3. 优先恢复路由文件中的 501 stub，确保服务可启动，再逐步修复
