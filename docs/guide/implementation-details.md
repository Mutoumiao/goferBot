# 工具实现细节

以下是当前工具链的具体实现机制。如果未来更换工具容器，本章内容需要更新，但架构原则不变。

## 模块开发指南模板

每个业务模块的 Trellis 开发指南遵循标准 10 章节结构：

1. **Purpose** — 指南目的
2. **Primary OpenSpec** — 权威 OpenSpec capability 链接（REFERENCE_ONLY 标头已声明）
3. **Related OpenSpec** — 相关 OpenSpec capability 链接
4. **Related Trellis Guides** — 相关模块开发指南（跨模块导航）
5. **When You Need To** — 触发条件（什么情况下应该读这篇指南）
6. **Module Dependencies** — 依赖的库/框架
7. **Development Entry** — 代码入口文件路径
8. **Implementation Notes** — 实现要点与模式
9. **Testing Checklist** — 测试验证清单
10. **Common Pitfalls** — 常见陷阱

> 指南顶部必须包含 `REFERENCE_ONLY` 标头。

---

## OpenSpec Delta Spec 格式

Delta specs（在 `changes/<name>/specs/` 下）使用以下标记：

```markdown
## ADDED Requirements
### Requirement: 新功能名
系统 SHALL 做某件新事。
#### Scenario: 场景名
- **WHEN** ...
- **THEN** ...

## MODIFIED Requirements
### Requirement: 现有功能名
#### Scenario: 新增/修改的场景
- **WHEN** ...
- **THEN** ...

## REMOVED Requirements
### Requirement: 废弃功能名

## RENAMED Requirements
- FROM: `### Requirement: 旧名称`
- TO: `### Requirement: 新名称`
```

---

## 交叉引用路径

- **Trellis → OpenSpec**：markdown 相对链接（如 `../../../../openspec/specs/chat/spec.md`），REFERENCE_ONLY 标头声明
- **OpenSpec → Trellis**：`证据来源` 字段引用 Trellis 指南路径或代码文件路径
- **OpenSpec 内部**：markdown 链接跨 capability 引用
- **Trellis 内部**：index.md 表格导航 + Related Trellis Guides
- **JSONL manifests**：`{"file": "<repo-relative-path>", "reason": "<why>"}` 格式，可引用 `.trellis/spec/` 和 `openspec/specs/` 任意文件

---

## Trellis 子代理上下文清单

`implement.jsonl` 和 `check.jsonl` 通过 repo-root 相对路径加载上下文文件，可以混合引用 Trellis 指南和 OpenSpec specs。

---

## 相关文档

- [知识架构总览](knowledge-architecture.md) — 目录规范与容器说明
- [权威源原则](authority-principle.md) — 交叉引用的理论基础
- [Spec 更新参考指南](spec-update-reference.md) — 两种 Spec 格式差异对比
