# Review 模板

```markdown
---
scope: {phase-3 / f-06 / file-manager-group / project / security-baseline}
type: {code / spec / security / acceptance}
date: {YYYY-MM-DD}
issues: [{issue-id}, {issue-id}]
status: {completed / partial / failed}
---

# {Scope} {Type} 审查报告

> **审查类型**：{代码审查 / 规格对齐 / 安全审查 / 验收审查}
> **审查范围**：{Phase 3 / f-06~f-08 / 全项目}
> **覆盖 Issue**：{issue 列表}
> **审查日期**：{日期}
> **总体结论**：{通过 / 有条件通过 / 不通过}

---

## 审查摘要

- **问题统计**：Critical {N} | Major {N} | Minor {N} | Info {N}
- **修复状态**：已修复 {N} / 未修复 {N}

| 维度 | Critical | Major | Minor | Info |
|------|----------|-------|-------|------|
| 后端 | {N} | {N} | {N} | {N} |
| 前端 | {N} | {N} | {N} | {N} |

---

## 覆盖 Issue

- [{issue-id}](../02-issues/{issue-id}-{slug}.md) — {功能描述}
- [{issue-id}](../02-issues/{issue-id}-{slug}.md) — {功能描述}

---

## 🔴 Critical（阻塞性，必须修复）

### C1. {问题标题} [{维度}] {状态}

- **位置**：`{文件路径}:{行号}`
- **详情**：{问题描述}
- **影响**：{不修复的后果}
- **建议**：{修复方案}
- **修复提交**：`{commit hash}`（如已修复）

---

## 🟠 Major（重要，建议修复）

### M1. {问题标题} [{维度}] {状态}

...

---

## 🟡 Minor（轻微，可选修复）

...

---

## 🔵 Info（建议）

...

---

## Spec 对齐检查

### {issue-id} {功能名称}

| 验收标准 | 状态 | 证据 |
|----------|------|------|
| {标准 1} | ✅ / ❌ / ⚠️ | {文件位置} |
| {标准 2} | ✅ / ❌ / ⚠️ | {文件位置} |

---

## 修复优先级建议

**建议本次修复：**
- {问题编号} — {问题简述}

**建议后续迭代：**
- {问题编号} — {问题简述}

---

*报告生成时间：{时间}*
```

---

## 填写说明

| 字段 | 说明 |
|------|------|
| `scope` | 审查范围的语义化标识 |
| `type` | 审查类型 |
| `issues` | 本次审查覆盖的所有 issue 编号 |
| `status` | 总体结论状态 |
| `C/M/m/I` | Critical/Major/Minor/Info 四级分类 |
