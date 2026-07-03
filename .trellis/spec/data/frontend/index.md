# Data Schema 开发指南索引

> **Purpose**：本索引是 `packages/data` 共享 Schema 包开发的导航中枢。Trellis 记录"如何用 Zod 表达 Schema"（HOW），OpenSpec 记录"Schema 的业务字段定义"（WHAT）。
> AI Agent 在此找到 Zod 表达模式与组织约定；如需具体业务字段（如 LangGraph 管线状态字段、文档状态机字段），请按下方映射跳转 OpenSpec 权威源。

---

## 包定位

`packages/data` 是纯 TypeScript Schema 包：
- 仅包含 Zod Schema 和 TypeScript 类型定义
- 作为前后端共享的契约层
- 不含业务逻辑、不含运行时副作用

---

## 通用开发指南

| 指南 | 描述 |
|------|------|
| [目录结构](./directory-structure.md) | 纯 Schema 包目录组织约定 |
| [组件指南](./component-guidelines.md) | Zod Schema 定义模式与组织约定 |
| [Hook 指南](./hook-guidelines.md) | 工具函数和组合模式 |
| [状态管理](./state-management.md) | 配置状态、业务流程状态的 Zod 表达模式 |
| [质量指南](./quality-guidelines.md) | Schema 代码标准、禁止模式 |
| [类型安全](./type-safety.md) | Zod 验证、TypeScript 类型派生 |

---

## 模块开发指南

> Data 包的 Schema 主要服务以下业务模块。具体业务字段定义不在 Trellis 中，请查阅 OpenSpec。

| 模块 | Trellis 开发指南 | OpenSpec 权威源 |
|------|-----------------|----------------|
| LangGraph 管线状态 | [state-management.md](./state-management.md) | [openspec/specs/companion/spec.md](../../../openspec/specs/companion/spec.md) |
| 文档状态机 | [state-management.md](./state-management.md) | [openspec/specs/document/spec.md](../../../openspec/specs/document/spec.md) |
| Chat SSE Chunk | [state-management.md](./state-management.md) | [openspec/specs/chat/spec.md](../../../openspec/specs/chat/spec.md) |

---

## Progressive Knowledge Loading 流程

当你要新增/修改一个 Schema 时：

1. **第一步**：查阅对应 Trellis 指南（如 `state-management.md`）了解 Zod 表达模式（discriminatedUnion、Schema 组织约定）
2. **第二步**：若需具体业务字段定义 → 跳转对应 OpenSpec capability spec.md
3. **第三步**：在 `packages/data` 中按模式新增/修改 Schema，类型派生由前端/后端各自导入

**示例流程**：新增 LangGraph 管线状态字段
↓
读 `state-management.md`（Zod discriminatedUnion 表达模式）
↓
读 `openspec/specs/companion/spec.md`（业务字段定义、状态机契约）
↓
在 `packages/data` 添加 Zod Schema 并导出类型

---

## OpenSpec 相关 capability 索引

Data 包涉及的 OpenSpec 业务规范（按需查阅，不要预加载）：

- [chat](../../../openspec/specs/chat/spec.md) — chatMessagesChunkSchema 共享契约业务定义
- [companion](../../../openspec/specs/companion/spec.md) — LangGraph 管线状态字段、Memory 类型
- [document](../../../openspec/specs/document/spec.md) — 文档状态机状态字段
- [session](../../../openspec/specs/session/spec.md) — Session/Message 业务契约
- [settings](../../../openspec/specs/settings/spec.md) — 用户/系统配置业务字段
- [user](../../../openspec/specs/user/spec.md) — 用户档案业务字段

---

**语言**：所有文档使用**简体中文**编写。
