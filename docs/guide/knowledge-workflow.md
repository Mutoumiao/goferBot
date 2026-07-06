# 知识生命周期与工作流

开发活动按是否**改变 Business Knowledge** 划分为两条独立主流程。两者的根本区别在于起点：Business Change 由业务定义驱动，Development Task 由开发任务驱动。

## 判断方法

对任务问："这个任务是否改变了系统'是什么'（业务规则、API 契约、验收标准）？"

- **是** → Workflow A（Business Change）
- **否** → Workflow B（Development Task）

---

## Workflow A: Business Change（业务变更）

**适用场景**：新增功能、业务重设计、改变外部行为的架构演进、领域模型变更。

**核心特征**：由 OpenSpec 主导完整的 Analysis & Planning，`openspec-apply-change` 进入实现时已加载全部 Business Context（proposal → design → tasks → delta specs），**不再需要 trellis-before-dev**。

```
Grill Me（需求澄清与拷问）
  ↓
整理拷问记录到 docs/grill-sessions/
  ↓
openspec-explore（深入代码现状 + 探索替代方案 + Gap Analysis）
  ↓
补充拷问记录（explore 中发现的新问题）
  ↓
openspec-propose（创建 change：proposal.md + design.md + tasks.md + specs/）
  ↓                ↓
  │           specs/ 中根据变更类型生成：
  │           - ADDED（新增能力）
  │           - MODIFIED（修改现有能力）
  │           - REMOVED（废弃能力）
  │           - RENAMED（重命名）
  │                ↓
  │           Review（人工确认）
  │                ↓
  └──────────→ openspec-apply-change（按 Slice 实现）
                    ↓
               开发实现（apply-change 已加载完整 Business Context，
               直接按 tasks 执行，无需 before-dev）
                    ↓
               trellis-check（质量检查：编码规范、测试、架构一致性）
                    ↓
               trellis-update-spec（沉淀 HOW 经验到 .trellis/spec/）
                    ↓
               openspec-sync-specs（合并 delta specs 到主 specs）
                    ↓
               openspec-archive-change（归档变更）
                    ↓
               清理/重写受影响的 Trellis 指南（如 MODIFIED/REMOVED 场景）
```

### 为什么没有 before-dev

`openspec-apply-change` 启动时已读取 proposal、design、tasks、delta specs 四份文档，拥有完整的业务上下文、架构设计、任务拆分和验收标准。此时再跑 before-dev 是重复加载，且时间顺序错误（before-dev 应在规划前而非实现前）。

### 子类型说明

| 子类型 | specs 特征 | 特殊注意 |
|-------|-----------|---------|
| 新增功能（Additive） | 仅 ADDED | 低风险，新功能不影响现有行为 |
| 业务重设计（Redesign） | MODIFIED + REMOVED + ADDED | 风险最高，必须含数据迁移和向后兼容方案，需清理旧 Trellis 指南 |
| 架构演进（Architecture） | MODIFIED（如 API 契约变化） | design.md 重点论证方案选择，需更新受影响的 Trellis 指南 |

---

## Workflow B: Development Task（开发任务）

**适用场景**：Bug 修复、纯重构（不改变外部行为）、性能优化、测试补充、代码清理、小型工具函数调整。

**核心特征**：不改变 Business Knowledge，没有 OpenSpec change 产物。起点是一个具体的开发任务而非业务需求，此时需要 `trellis-before-dev` 加载项目开发上下文。

```
trellis-brainstorm（可选，复杂 Bug/重构需要澄清根因）
  ↓
trellis-before-dev（加载 Trellis 开发指南：index → 通用指南 → 模块指南）
  ↓
开发实现
  ↓
trellis-check（质量检查 + 回归验证）
  ↓
发现业务规则本身有问题（代码符合 spec 但行为不对）？
  ├─ 是 → 升级到 Workflow A（OpenSpec propose）
  └─ 否 → 继续
  ↓
trellis-update-spec（沉淀防坑经验/新模式到 .trellis/spec/）
```

### 区分关键

- 代码**不符合** OpenSpec spec → 实现问题 → Workflow B
- 代码**符合** OpenSpec spec 但行为不对 → 业务规则问题 → 升级到 Workflow A
- 纯重构不改变外部行为 → Workflow B（不走 OpenSpec）

---

## 相关文档

- [渐进式知识加载](progressive-knowledge-loading.md) — 两条 Workflow 各自的加载路径
- [知识沉淀规则](knowledge-capture-rules.md) — 开发完成后的知识沉淀流程
- [Spec 更新参考指南](spec-update-reference.md) — update-spec 时的决策参考
