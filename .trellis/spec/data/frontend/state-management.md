# Data 包状态管理开发指南

> **REFERENCE_ONLY**: 此文件记录开发指南（HOW）。业务规范权威源为 [openspec/specs/companion/spec.md](../../../../openspec/specs/companion/spec.md) 和 [openspec/specs/document/spec.md](../../../../openspec/specs/document/spec.md)（WHAT）。LangGraph 管线状态字段 / 文档状态机状态字段 应以 OpenSpec 为准。

---

## Purpose

帮助开发者在 `@goferbot/data` 包中使用 Zod 表达状态机与共享 Schema。本包不含状态管理库（如 Zustand），"状态管理"指**如何设计 Schema 来支持前后端的状态管理需求**：状态数据结构定义、配置层级组织、业务流程状态表达、状态转换验证。

## Primary OpenSpec

- [openspec/specs/companion/spec.md](../../../../openspec/specs/companion/spec.md) — Companion 管线节点顺序、条件分支、LLM 预算（业务字段权威源）
- [openspec/specs/document/spec.md](../../../../openspec/specs/document/spec.md) — 文档解析管线、状态机转换（业务字段权威源）

## Related OpenSpec

- [openspec/specs/chat/spec.md](../../../../openspec/specs/chat/spec.md) — `chatMessagesChunkSchema` 流式响应事件定义

## Module Dependencies

- Zod 3.x — Schema 定义与运行时校验
- `@goferbot/data` — 前后端共享 Schema 包
- TypeScript — 通过 `z.infer<typeof schema>` 派生类型

## Development Entry

- `packages/data/src/schemas/` — 全部 Schema 文件（按业务模块分文件组织）
- `packages/data/src/schemas/companion-pipeline.schema.ts` — Companion 管线 Schema
- `packages/data/src/schemas/document.schema.ts` — 文档 Schema
- `packages/data/src/schemas/settings.schema.ts` — 分层配置 Schema

## Implementation Notes

### Zod Schema 定义模式

- `z.object({...})` 表达结构化状态对象
- `z.enum([...])` 表达有限状态集合（禁止用 `z.number()` 编码状态）
- `z.record(z.string(), valueSchema)` 支持动态扩展的映射型配置（如多 Provider 配置）
- `z.array(...)` 表达列表型状态（如 secondary intents、files）
- `.default(...)` 为状态字段提供合理默认值，避免 `undefined`
- `.optional()` / `.nullable()` 区分"可缺失"与"显式空值"

### 状态机用 Zod 表达的方法

- **状态枚举**：用 `z.enum(['state1', 'state2', ...])` 表达状态机的有限状态集
- **判别联合**：用 `z.discriminatedUnion('event', [VariantA, VariantB, ...])` 表达同一状态家族中形态不同的变体（如 SSE chunk 的 `message` / `message_end` / `error` 三种事件 payload 结构不同；文档状态机的 `pending` / `processing` / `ready` 字段集不同）。比 `z.union` 更优：Zod 能根据判别字段直接定位变体，错误消息更精准，性能更好
- **状态转换验证**：用 `.refine(({ status, previousStatus }) => ...)` 配合 `validTransitions` 映射表验证转换合法性
- **状态相关常量与 Schema 共置**：`export const DOCUMENT_STATUSES = [...] as const` 与 `z.enum(DOCUMENT_STATUSES)` 同源，避免枚举值不一致
- **回退值**：当状态节点计算失败时，提供 fallback 对象（含 `as const` 字面量）确保管线不中断

### Schema 组织约定

- 按业务模块分文件：`companion-pipeline.schema.ts`、`document.schema.ts`、`settings.schema.ts`
- 分层配置按功能域划分：`chat` / `rag` / `companion` / `indexing` / `appearance`，每个分类独立 Schema + 独立默认值
- 前后端共享 Schema 由 `@goferbot/data` 统一导出，禁止在业务代码中重复定义

### 类型派生模式

```typescript
export const documentSchema = z.object({ /* ... */ })
export type Document = z.infer<typeof documentSchema>
```

类型永远从 Schema 派生，禁止手写 interface 与 Schema 脱节。

### 前后端共享 Schema 导入模式

```typescript
// 前端 / 后端 / Worker 统一导入
import { documentSchema, type Document } from '@goferbot/data'
```

### 状态字段命名规范

- 推荐：`status`、`role`、`phase`、`safetyLevel`、`boundaryAction`
- 禁止：`type`、`kind`、`mode`（语义模糊）以及单字母缩写（`u`、`c`、`e`）

## Testing Checklist

- [ ] Schema 正确校验合法数据（`schema.parse(valid)` 不抛错）
- [ ] Schema 正确拒绝非法数据（`schema.parse(invalid)` 抛 ZodError）
- [ ] 状态转换 `.refine()` 覆盖所有合法 / 非法转换路径
- [ ] 类型派生与后端一致（`z.infer` 与后端 ORM 输出兼容）
- [ ] 默认值完整（`schema.parse({})` 在所有可选字段上产出合理默认）
- [ ] fallback 对象通过对应 Schema 校验

## Review Checklist

- [ ] 新增 / 修改状态字段是否同步更新 OpenSpec（companion / document spec）
- [ ] Schema 变更是否同步更新前后端导入方
- [ ] 状态枚举值是否与 `*_STATUSES` 常量同源
- [ ] 新增状态字段是否提供默认值
- [ ] `.refine()` 错误消息是否包含 `path` 字段定位问题字段

## Common Pitfalls

1. **状态枚举值不一致**：不同 Schema 中使用不同的状态值 —— 用 `*_STATUSES as const` + `z.enum(...)` 单源化
2. **状态字段缺少默认值**：未初始化时为 `undefined` —— 一律 `.default(...)`
3. **状态转换无验证**：允许任意跳转 —— 用 `.refine()` + `validTransitions` 映射表
4. **流式响应缺少事件类型**：无法区分 SSE 事件 —— 用 `z.enum(['message', 'message_end', 'error'])` 在 `event` 字段区分
5. **配置状态缺少默认值**：导致配置读取失败 —— 每个分类 Schema `.default({...})`
6. **状态字段命名模糊**：`type` / `kind` / `mode` 语义不清 —— 改用 `status` / `role` / `phase`
7. **手写类型与 Schema 脱节**：interface 与 Zod Schema 各自演化 —— 一律 `z.infer<typeof schema>`
8. **数字编码状态**：`z.number()` 表示状态 —— 改用 `z.enum()` 枚举
9. **一个 Schema 堆叠多个状态字段**：难维护 —— 拆分为独立的状态 Schema

## Reusable Patterns

- **Zod 状态机模式**：`z.enum([...])` 表达状态集 + `.refine()` 验证转换 + `*_STATUSES as const` 常量共置
- **判别联合状态模式**：`z.discriminatedUnion('status', [PendingSchema, ProcessingSchema, ReadySchema])` 表达形态各异的状态变体，比 `z.union` 错误消息更精准、性能更好
- **分层配置 Schema 模式**：顶层 `z.object({ chat, rag, companion, indexing, appearance })`，每子域独立 Schema + `.default({...})`
- **动态扩展配置模式**：`z.record(z.string(), valueSchema)` 支持运行时新增配置项（如多 Provider）
- **fallback 状态对象模式**：导出含 `as const` 字面量的 fallback 值，确保节点失败时管线不中断
- **类型派生模式**：`export type T = z.infer<typeof schema>`，类型永远从 Schema 派生
- **前后端共享 Schema 模式**：`@goferbot/data` 统一导出 Schema 与类型，业务代码仅导入不重复定义
