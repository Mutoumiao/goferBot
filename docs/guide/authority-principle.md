# 权威源原则

## Authority Principle（权威源原则）

每条知识有且仅有一个 **Source of Truth**。所有其他位置只能**引用**（Reference），不得**复制**（Copy）。

| 知识类型 | 唯一权威源 | 冲突时以谁为准 |
|---------|-----------|--------------|
| 业务规则、API 契约、架构定义、领域模型、验收标准、系统流程 | `openspec/specs/` | OpenSpec |
| 编码约定、实现模式、测试策略、审查清单、常见陷阱、开发入口 | `.trellis/spec/` | Trellis |
| 工作区强制规则（审查标准、安全规范、提交规范、Ponytail） | `.trae/rules/` | Rules |

**Golden Rule（知识归属判断法）**：对每条知识问——

> "如果未来实现方式改变（换框架、换架构、换技术栈），这条知识是否仍然有效？"

- **仍然有效** → Business Knowledge → 放入 OpenSpec
- **不再有效** → Development Knowledge → 放入 Trellis
- **始终强制（无论怎么实现都必须遵守）** → Runtime Rules → 放入 `.trae/rules/`

**冲突解决**：发现矛盾时，以权威源为准。例如 Trellis 指南中描述的行为与 OpenSpec 冲突，以 OpenSpec 为准；代码与 Trellis 指南冲突，以指南为准。

---

## Reference > Copy（引用优于复制）

**强制原则**：任何知识不得在多个权威源中重复维护。

- Trellis 指南遇到业务规则 → 链接到 OpenSpec，不得复述
- OpenSpec 遇到实现细节 → 在"证据来源"中引用代码路径或 Trellis 指南，不得描述代码模式
- `.trae/rules/` 遇到项目特有的编码约定 → 引用 Trellis 指南，不得内联编码规范
- CLAUDE.md 是**导航索引**，不是知识仓库。它的职责是告诉 AI "去哪里找"，而不是"内容是什么"

**REFERENCE_ONLY 标头约定**：所有涉及业务的 Trellis 模块指南顶部必须包含：

```markdown
> **REFERENCE_ONLY**: 此文件记录开发指南（HOW）。业务规范权威源为
> [openspec/specs/<capability>/spec.md](relative/path/to/spec.md)（WHAT）。
> <具体哪些内容以 OpenSpec 为准>。
```

这是防止知识泄漏的第一道防线：AI 阅读指南时立刻知道"业务细节不在此文件中"。

**判断法**：如果你发现自己在复制粘贴一段内容到另一个文件——STOP。你应该放一个链接。

---

## 相关文档

- [知识架构总览](knowledge-architecture.md) — 三层知识架构 + 职责边界 + 目录规范
- [Spec 更新参考指南](spec-update-reference.md) — 了解权威源原则如何指导 spec 更新决策
- [知识沉淀规则](knowledge-capture-rules.md) — 什么内容该沉淀到哪里
