# 知识沉淀规则

## trellis-update-spec 沉淀规则

`trellis-update-spec` 用于将开发经验沉淀到 `.trellis/spec/`，不是修改业务规则。它在 **Workflow A 和 Workflow B 中都会使用**——开发完成后（无论走哪条流程），都应沉淀有价值的 HOW 经验。

### 触发时机

- 完成 Workflow A 的一个功能特性后
- 完成 Workflow B 的 Bug 修复后（特别是根因分析）
- 发现新的实现模式后
- 踩过一个非显而易见的坑后
- 确立新的团队约定后

### 沉淀内容与放置位置

| 类型 | 放置位置 |
|------|---------|
| 设计决策（选 X 不选 Y 的原因，仅涉及实现层） | 模块指南 Implementation Notes |
| 项目约定（这个项目怎么做 X） | 通用指南或模块指南 |
| 新的可复用代码模式 | 模块指南 Reusable Patterns |
| 禁止模式/反模式 | 质量指南或模块指南 Common Pitfalls |
| 常见错误/陷阱及根因 | 模块指南 Common Pitfalls |
| 思维触发点/决策框架 | guides/ 下的思维指南 |

### 禁止沉淀内容

业务规则、API 契约定义、状态机定义、领域模型——遇到此类内容应放入 OpenSpec 并在 Trellis 中引用。

---

## OpenSpec 变更触发（走 Workflow A）

以下情况必须走 Workflow A（OpenSpec change 流程），即判断"是否改变系统是什么"为"是"时：

- 新的业务能力（ADDED requirement）
- 业务行为改变（MODIFIED requirement）
- 废弃业务能力（REMOVED requirement）
- API 契约变更
- 架构决策影响系统外部行为
- 领域模型变更

---

## 相关文档

- [Spec 更新参考指南](spec-update-reference.md) — Trellis vs OpenSpec 定位 + update-spec 决策流程
- [知识生命周期与工作流](knowledge-workflow.md) — Workflow A 和 Workflow B 的完整流程
- [权威源原则](authority-principle.md) — Golden Rule 判断知识归属
