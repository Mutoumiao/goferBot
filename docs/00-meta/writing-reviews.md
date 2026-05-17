# Review 归档规范

> 审查是阶段性的集体行为，不是一对一绑定 issue。
> 审查报告必须自描述覆盖范围，通过 frontmatter 建立与 issue 的关联。

---

## 目录结构

```
docs/07-reviews/
└── {scope}/
    └── {type}-v{N}.md
```

| 元素 | 规则 |
|------|------|
| `scope` | 审查范围的语义化标识 |
| `type` | 审查类型：code / spec / security / acceptance |
| `N` | 版本号，同一 scope + 同 type 递增 |

---

## Scope 命名规则

Scope 使用**语义化名称**，反映审查覆盖的范围：

| 场景 | Scope 格式 | 示例 |
|------|-----------|------|
| Phase 批次审查 | `phase-{N}` | `phase-3` |
| 单 Issue 深度审查 | `{issue-id}` | `f-06` |
| 跨 Issue 功能组审查 | 语义化组名 | `file-manager-group` |
| 全项目综合审查 | `project` | `project` |
| 专项审查 | 专项名称 | `security-baseline` |

### Scope 命名约束

- 使用 kebab-case
- 优先使用已有约定（`phase-{N}`、`project`）
- 自定义组名应直观反映审查范围
- **禁止**用 `overall`、`all`、`temp`、`latest` 等模糊名称

---

## Type 枚举

| Type | 含义 | 触发时机 |
|------|------|----------|
| `code` | 代码审查 | 阶段开发完成后 |
| `spec` | 规格对齐审查 | 发现实现与 spec 不符时 |
| `security` | 安全审查 | 涉及认证/授权/加密/输入处理时 |
| `acceptance` | 验收审查 | Issue 关闭前最终验证 |

---

## 版本规则

- 同一 `scope` + 同 `type`，版本号递增
- 每次审查必须生成**独立文件**，禁止在已有文件追加
- 修复后复查创建新版本（`code-v1.md` → `code-v2.md`）

---

## 模板

```markdown
---
scope: phase-3
type: code
date: 2026-05-17
issues: [f-06, f-07, f-08, b-02]
status: completed
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

### 已修复的 Spec 偏差

1. **{issue-id} {偏差描述}** → {修复方式} ✅

### 未修复的 Spec 偏差

1. **{issue-id} {偏差描述}** — {原因}

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

## 问题分级标准

| 级别 | 定义 | 修复要求 |
|------|------|----------|
| **Critical** | 阻塞性：功能不可用、数据丢失、安全漏洞 | 必须修复，否则不通过 |
| **Major** | 重要：性能问题、架构缺陷、可维护性风险 | 建议修复，可协商延期 |
| **Minor** | 轻微：代码风格、冗余逻辑、边缘情况 | 可选修复 |
| **Info** | 建议：优化建议、未来改进方向 | 仅供参考 |

---

## 与 Issue 的双向关联

### 在 Issue 中引用审查

```markdown
## 审查历史

| 审查 | 日期 | 结论 | 报告 |
|------|------|------|------|
| Phase 3 代码审查 | 2026-05-17 | 有条件通过 | `07-reviews/phase-3/code-v1.md` |
| Phase 3 修复复查 | 2026-05-18 | 通过 | `07-reviews/phase-3/code-v2.md` |
```

### 在审查报告中引用 Issue

```markdown
## 覆盖 Issue

- [f-06](../02-issues/f-06-knowledge-base-file-manager.md) — 知识库文件管理器
- [f-07](../02-issues/f-07-file-upload-component.md) — 文件上传组件
- [b-02](../02-issues/b-02-knowledge-base-crud-api.md) — 知识库 CRUD API
```

---

## 禁止事项

| 禁止 | 错误示例 | 正确示例 |
|------|----------|----------|
| 用日期命名文件 | `code-2026-05-17.md` | `code-v1.md` |
| 用模糊 scope | `overall/`、`all/` | `project/`、`phase-3/` |
| 追加修改旧报告 | 在 `code-v1.md` 追加新问题 | 新建 `code-v2.md` |
| 缺少 frontmatter | 文件头部无 YAML | 必须包含 scope/type/date/issues/status |
| 无覆盖 issue 列表 | 报告内不说明审查了哪些 issue | 必须列出 issues 字段 |
