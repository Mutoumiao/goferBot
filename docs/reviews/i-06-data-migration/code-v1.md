---
scope: i-06-data-migration
type: code
date: 2026-05-18
issues: [i-06-data-migration]
status: completed
---

# i-06 代码审查报告

## 审查摘要

- **审查类型**：代码审查 + Spec 对齐审查
- **审查对象**：`packages/server/src/tools/export-v1-data.ts`（新增 269 行）、`packages/server/package.json`（修改 1 行）
- **总体结论**：🟠 有条件通过 — 1 个 Major 问题需修复
- **问题统计**：Critical 0 | Major 1 | Minor 2 | Info 1

---

## 发现的问题

### 🟠 Major

1. **`sort_order=0` 时错误回退到 index**
   - 位置：`export-v1-data.ts:206`
   - 代码：`sortOrder: row.sort_order || index`
   - 详情：`sort_order = 0` 是合法值（V1 默认值为 0），但 `0 || index` 会因 falsy 短路而错误使用数组索引。例如用户手动将某知识库排为第 0 位，导出后会被改序号。
   - 建议：改为 `sortOrder: row.sort_order ?? index`
   - 依据：V1 schema `sort_order INTEGER DEFAULT 0`

### 🟡 Minor

1. **退出码 3/4 未区分**
   - 位置：`export-v1-data.ts:261-263`
   - 详情：spec 定义退出码 3 为数据库读取错误，退出码 4 为输出目录不可写。当前实现将所有运行时错误统一退出码 3。
   - 建议：区分 `EACCES`/`ENOENT` 等文件系统错误（退出码 4）与数据库错误（退出码 3）。

2. **只读模式设置 WAL pragma 无意义**
   - 位置：`export-v1-data.ts:51`
   - 详情：`db.pragma('journal_mode = WAL')` 在只读模式下无实际效果（WAL 是写入优化）。虽无害但造成困惑。
   - 建议：移除该行，或添加注释说明为何需要。

### 🔵 Info

1. **参数 `--output` 后跟 flag 值时会误解析**
   - 位置：`export-v1-data.ts:38`
   - 详情：若用户执行 `pnpm export:v1 -- --db a.db --user-id uuid --output`，则 `--output` 后的下一个参数（无）会被当作路径。这是简易 CLI 参数解析的通病。
   - 建议：生产级工具可考虑使用 `commander` 或 `yargs` 库，当前阶段不必要。

---

## Spec 对齐检查

### 功能规格对齐

| 用户故事 / 需求 | 状态 | 证据 |
|---------------|------|------|
| 导出 V1 SQLite 中 sessions | ✅ | `exportSessions()` L83-113 |
| 导出 messages（关联原会话） | ✅ | `exportMessages()` L132-155 |
| 导出 knowledge_bases（仅未删除） | ✅ | `exportKnowledgeBases()` L180-212，`WHERE deleted_at IS NULL` |
| 输出 NDJSON 格式 | ✅ | `JSON.stringify(v2)` + `.join('\n')` |
| 导出后显示统计摘要 | ✅ | L256-260 |
| 仅读取不修改 | ✅ | `readonly: true` L50 |

### CLI 规格对齐

| 规格条目 | 状态 | 证据 |
|---------|------|------|
| 命令 `pnpm export:v1 -- --db <path> --user-id <uuid>` | ✅ | package.json scripts |
| `--db` 必填 | ✅ | L18-21 |
| `--user-id` 必填 + UUID 校验 | ✅ | L31-35 |
| `--output` 可选，默认 `./v1-export/YYYY-MM-DD/` | ✅ | L37-38 |
| 退出码 1：参数错误 | ✅ | L20, L28, L34 |
| 退出码 2：数据库不可用 | ✅ | L46, L55 |
| 退出码 3：读取错误 | ✅ | L262 |
| 退出码 4：输出不可写 | ❌ | 见 Major-2 |

### V1→V2 字段映射检查

| 表 | V1 字段 | V2 字段 | 状态 |
|----|---------|---------|------|
| sessions | id | id | ✅ |
| sessions | (注入) | userId | ✅ |
| sessions | title | title | ✅ |
| sessions | provider | provider | ✅ |
| sessions | model | model | ✅ |
| sessions | created_at | createdAt | ✅ |
| sessions | updated_at | updatedAt | ✅ |
| messages | id | id | ✅ |
| messages | session_id | sessionId | ✅ |
| messages | role | role | ✅ |
| messages | content | content | ✅ |
| messages | created_at | createdAt | ✅ |
| knowledge_bases | id | id | ✅ |
| knowledge_bases | (注入) | userId | ✅ |
| knowledge_bases | name | name | ✅ |
| knowledge_bases | is_pinned | isPinned | ✅（0/1→boolean） |
| knowledge_bases | sort_order | sortOrder | 🟠（`\|\|` 应改为 `??`） |
| knowledge_bases | icon | icon | ✅ |
| knowledge_bases | created_at | createdAt | ✅ |

### 行为规格对齐

| 场景 | 状态 | 证据 |
|------|------|------|
| 参数校验（缺参数→退出码 1） | ✅ | L18-21 |
| 数据库检查（文件不存在→退出码 2） | ✅ | L44-47 |
| 导出进度（逐表打印） | ✅ | L228, L237, L246 |
| 成功统计摘要 | ✅ | L256-260 |
| 表不存在非致命（优雅跳过） | ✅ | L90-92, L136-138, L189-191 |
| 空表处理 | ✅ | L95-98, L141-143, L194-196 |

### 时间戳转换检查

| 输入（Unix 时间戳） | 判断逻辑 | 结果 |
|---------------------|----------|------|
| 1700000000（秒，10 位） | `< 10^10 → * 1000` | 正确转为毫秒 |
| 1716000000000（毫秒，13 位） | `>= 10^10 → 保持` | 正确 |
| 9999999999（临界秒） | `< 10^10 → * 1000` | 正确（≈2286 年） |

---

## 类型检查

```
packages/server type-check → ✅ 通过
```
