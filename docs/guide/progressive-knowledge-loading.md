# 渐进式知识加载

AI Agent **绝对不要预加载全部规范**。知识加载路径取决于当前处于哪条工作流。

## Workflow A 的知识加载（Business Change）

Business Change 流程中，知识加载由 OpenSpec 工具链自然完成，不需要显式调用 before-dev：

```
openspec-explore
  ↓ 自动读取：现有 specs + 代码现状
openspec-propose
  ↓ 自动读取：现有 specs + explore 结果
  ↓ 产出：proposal.md + design.md + tasks.md + specs/（完整 Business Context）
openspec-apply-change
  ↓ 自动读取：change 下所有 artifacts（Business Context 已完备）
  ↓ 按 tasks 逐 Slice 实现
  ↓ 如需开发模式参考 → 按需跳转 Trellis 指南（通过 spec 中的链接或模块指南引用）
trellis-check
  ↓ 按需加载：质量检查清单、测试策略
trellis-update-spec
  ↓ 按需加载：现有 Trellis 指南（决定沉淀到哪里）
```

**核心原则**：Business Change 中 OpenSpec artifacts 本身就是最完整的上下文。Trellis 指南作为 HOW 参考按需跳转，不是前置加载项。

## Workflow B 的知识加载（Development Task）

Development Task 流程中，没有 OpenSpec artifacts 承载上下文，需要通过 Navigation Hub 加载开发知识：

```
当前 Task
  ↓
trellis-before-dev
  ↓
Navigation Hub: .trellis/spec/<package>/<layer>/index.md
  ↓
  ├─ 按 Pre-Development Checklist 读取通用指南（error-handling、database 等）
  ├─ 按任务类型定位对应模块开发指南
  │    ↓
  │   模块指南（含 REFERENCE_ONLY 标头）
  │    ↓
  │   需要业务规则？→ 点击 Primary OpenSpec 链接
  │    ↓
  │   openspec/specs/<capability>/spec.md（业务知识按需加载）
  │    ↓
  │   涉及跨模块？→ Related OpenSpec → 返回 Navigation Hub 找对应模块指南
  │
  └─ 需要跨包思维？→ guides/index.md
```

## Navigation Hub 的核心职责

每个 `index.md` 不是简单的文件列表，而是知识导航中心。它负责：

1. **Pre-Development Checklist**：进入开发前必须阅读的通用指南（Workflow B 中使用）
2. **Module Guide Index**：按任务类型映射到对应模块指南（"做 X 看 Y"）
3. **OpenSpec Mapping**：每个模块指南对应的 OpenSpec capability
4. **Quality Gate**：完成开发后的质量检查项
5. **跨包导航**：指向 guides/ 和其他 package 的 index.md

**指南的 "When You Need To" 章节**：每个模块指南必须声明触发条件，让 AI 快速判断"这篇指南是否适用于当前任务"。

**跨模块导航**：通过 Related OpenSpec → Navigation Hub → Related Trellis Guides 实现，而不是直接复制其他模块的内容。

---

## 相关文档

- [知识生命周期与工作流](knowledge-workflow.md) — Workflow A 和 Workflow B 的完整流程
- [知识沉淀规则](knowledge-capture-rules.md) — 开发完成后如何沉淀知识
- [知识架构总览](knowledge-architecture.md) — 三层知识体系与目录结构
