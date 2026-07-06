# Spec 更新参考指南

本文档明确 **Trellis** 和 **OpenSpec** 的定位与 spec 职责划分，作为调用 `trellis-update-spec`、`openspec-propose` 等技能时的决策参考。

---

## Trellis 与 OpenSpec 定位对比

| 维度 | Trellis Spec | OpenSpec Spec |
|------|-------------|---------------|
| **知识类型** | Development Knowledge (HOW) | Business Knowledge (WHAT) |
| **回答的问题** | "这个项目怎么开发？" | "系统是什么？" |
| **权威源路径** | `.trellis/spec/` | `openspec/specs/` |
| **抽象层级** | 与实现绑定 | 与实现无关 |
| **变更频率** | 每次任务完成后自然沉淀 | 业务决策变更时 |
| **受众** | 开发者 / AI Agent | 产品 / 架构 / 开发 / AI Agent |

---

## 各自负责的 Spec 内容

### Trellis Spec 负责（HOW — 开发知识）

| 内容类型 | 示例 | 放置位置 |
|---------|------|---------|
| 设计决策（实现层） | "选择 BullMQ 而非 RabbitMQ，因为 xx" | 模块指南 Implementation Notes |
| 项目约定 | "本项目的错误处理统一用 Result<T> 模式" | 通用指南或模块指南 |
| 可复用代码模式 | "所有 LLM 调用统一走 LangChain ChatModel 封装" | 模块指南 |
| 禁止模式/反模式 | "不要在 Controller 中直接调用 Prisma" | 模块指南 Common Pitfalls |
| 常见错误及根因 | "N+1 查询通常发生在 include 嵌套过深时" | 模块指南 Common Pitfalls |
| 思维触发点/决策框架 | "选 ORM 还是 Raw SQL 的决策矩阵" | guides/ 下的思维指南 |
| 测试策略 | "单元测试 mock Prisma，集成测试用真实 DB" | 通用指南 |
| 代码入口路径 | "Chat 模块入口：packages/server/modules/chat/" | 模块指南 Development Entry |

### OpenSpec Spec 负责（WHAT — 业务知识）

| 内容类型 | 示例 | 格式 |
|---------|------|------|
| 业务规则 | "用户上传文档后系统 SHALL 自动分块" | `### Requirement:` + SHALL/MUST |
| API 契约 | "GET /api/chat/sessions 返回分页会话列表" | `### Requirement:` + Scenario |
| 领域模型 | "Session 属于 User，User 有多个 Session" | `### Requirement:` 描述 |
| 状态机 | "Companion 状态：draft → published → archived" | `### Requirement:` + 状态转换 Scenario |
| 验收标准 | "WHEN 用户发送消息 THEN 系统流式返回 AI 回复" | `#### Scenario:` + WHEN/THEN |
| 系统流程 | "RAG 管线分 5 阶段：QueryUnderstanding → ..." | `### Requirement:` + Scenario |

---

## update-spec 决策流程

当你完成开发任务，需要决定更新哪个 spec 时，遵循以下决策树：

```
开发完成，准备沉淀知识
  │
  ├─ 这是新发现的业务规则 / API 行为 / 验收标准？
  │   └─ 是 → 放入 OpenSpec
  │         ├─ 新增能力 → openspec-propose（ADDED）
  │         ├─ 修改现有行为 → openspec-propose（MODIFIED）
  │         └─ 废弃旧行为 → openspec-propose（REMOVED）
  │
  ├─ 这是实现层面的经验 / 模式 / 约定 / 陷阱？
  │   └─ 是 → 放入 Trellis（trellis-update-spec）
  │         ├─ 设计决策 → 模块指南 Implementation Notes
  │         ├─ 项目约定 → 通用指南或模块指南
  │         ├─ 代码模式 → 模块指南
  │         ├─ 禁止模式 → 模块指南 Common Pitfalls
  │         └─ 思维框架 → guides/
  │
  └─ 不确定？
      └─ 用 Golden Rule 判断：
         "如果换框架/换技术栈，这条知识还成立吗？"
         ├─ 仍然成立 → OpenSpec
         └─ 不成立 → Trellis
```

---

## 两种 Spec 的格式差异

### OpenSpec Spec 格式

使用 **SHALL / MUST** 声明行为，用 **Scenario** 定义验收条件：

```markdown
### Requirement: 用户消息发送
系统 SHALL 在用户发送消息后，通过 SSE 流式返回 AI 回复。

#### Scenario: 正常发送消息
- **WHEN** 用户向指定会话发送文本消息
- **THEN** 系统创建 Message（role=user）
- **AND** 系统通过 SSE 推送 AI 回复 chunk
- **AND** 流结束后系统创建 Message（role=assistant）

#### Scenario: 空消息被拒绝
- **WHEN** 用户发送空内容消息
- **THEN** 系统返回 400 错误
```

Delta Spec 使用四种标记：
- `## ADDED Requirements` — 新增能力
- `## MODIFIED Requirements` — 修改现有能力
- `## REMOVED Requirements` — 废弃能力
- `## RENAMED Requirements` — 重命名

详见 [工具实现细节](implementation-details.md)。

### Trellis Spec 格式

使用 **章节化指南** 格式，标准 10 章节结构：

1. **Purpose** — 指南目的
2. **Primary OpenSpec** — 权威 OpenSpec 链接（含 REFERENCE_ONLY 标头）
3. **Related OpenSpec** — 相关 OpenSpec 链接
4. **Related Trellis Guides** — 相关模块指南
5. **When You Need To** — 触发条件
6. **Module Dependencies** — 依赖
7. **Development Entry** — 代码入口
8. **Implementation Notes** — 实现要点（代码模式、设计决策）
9. **Testing Checklist** — 测试清单
10. **Common Pitfalls** — 常见陷阱

每个指南顶部必须包含：
```markdown
> **REFERENCE_ONLY**: 此文件记录开发指南（HOW）。业务规范权威源为
> [openspec/specs/<capability>/spec.md](path)（WHAT）。
```

详见 [工具实现细节](implementation-details.md)。

---

## 更新时机与触发条件

### Trellis Spec 更新时机（trellis-update-spec）

| 触发场景 | 典型产物 | 放置位置 |
|---------|---------|---------|
| 完成 Workflow A 功能特性 | 新模块指南或更新现有指南 | `.trellis/spec/<package>/<layer>/` |
| 完成 Workflow B Bug 修复 | Common Pitfalls 条目 | 对应模块指南 |
| 发现新的实现模式 | Implementation Notes 或 Reusable Patterns | 模块指南 |
| 踩坑后总结 | Common Pitfalls + 根因 | 模块指南 |
| 确立新团队约定 | 通用指南更新 | `.trellis/spec/<package>/<layer>/` |

### OpenSpec Spec 更新时机（openspec-propose / openspec-sync-specs）

| 触发场景 | 动作 |
|---------|------|
| 新增业务能力 | `openspec-propose` → ADDED |
| 业务行为改变 | `openspec-propose` → MODIFIED |
| 废弃旧功能 | `openspec-propose` → REMOVED |
| API 契约变更 | `openspec-propose` → MODIFIED |
| 领域模型变更 | `openspec-propose` → MODIFIED |
| Bug 修复中发现 spec 本身有误 | `openspec-propose` → MODIFIED（升级到 Workflow A） |

---

## 实操示例

### 场景 1：Bug 修复后沉淀经验

**背景**：修复了 Chat 模块中 SSE 流在某些情况下不发送 `[DONE]` 信号导致前端挂起的 Bug。

**根因**：当 LLM 返回空响应时，`StreamFinalize` 拦截器跳过了 finalize 逻辑。

**沉淀**：
- **Trellis**（trellis-update-spec）：在 Chat 模块指南 Common Pitfalls 中新增 "SSE 流必须处理空响应场景，确保 `[DONE]` 信号始终发送"
- **OpenSpec**：不需要更新（业务规则未变——spec 本来就要求流式返回）

### 场景 2：新增功能后更新 spec

**背景**：新增了 "文档批量上传" 功能。

**沉淀**：
- **OpenSpec**（openspec-propose → ADDED）：新增 Requirement "系统 SHALL 支持一次上传多个文档" + Scenario
- **Trellis**（trellis-update-spec）：在 Document 模块指南 Implementation Notes 中记录 "批量上传使用 BullMQ 队列异步处理，单次最多 20 个文件"

### 场景 3：发现业务规则本身有问题

**背景**：开发中发现 OpenSpec 定义的 Chat Session 删除行为不符合产品预期——spec 说删除 Session 时保留消息，但产品需要级联删除。

**沉淀**：
- **OpenSpec**（openspec-propose → MODIFIED）：修改 Chat spec 中 Session 删除的 Scenario，改为级联删除
- **Trellis**：不需要额外更新（Trellis 指南引用 OpenSpec，行为变更自动跟随）

---

## 相关文档

- [权威源原则](authority-principle.md) — Golden Rule 判断知识归属
- [知识沉淀规则](knowledge-capture-rules.md) — trellis-update-spec + OpenSpec 变更触发条件
- [工具实现细节](implementation-details.md) — 两种 Spec 的具体格式和模板
- [知识生命周期与工作流](knowledge-workflow.md) — Workflow A 和 Workflow B 的完整流程
