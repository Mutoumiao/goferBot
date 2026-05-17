# Issue 模板

```markdown
状态: needs-triage
分类: enhancement

## 要构建的内容

{垂直切片的简洁描述，不超过 3 句话}

## 规格引用

- 功能规格: docs/03-specs/{issue-id}/feature-spec.md
- 行为规格: docs/03-specs/{issue-id}/behavior-spec.md
- API 规格: docs/03-specs/{issue-id}/api-spec.md

## 验收标准

- [ ] {标准 1}
- [ ] {标准 2}
- [ ] {标准 3}

## 阻塞于

- {阻塞 issue 引用或 "无"}

## 范围外

- {不包含的内容}

## Agent 简报

**分类：** {enhancement/bug/refactor}
**摘要：** {一句话摘要}

**当前行为：**
{现在存在什么}

**期望行为：**
{此 issue 完成后应发生什么}

**关键接口：**
- {接口 1}
- {接口 2}

**验收标准：**
- [ ] {标准 1}
- [ ] {标准 2}

**范围外：**
- {不包含的内容}
```

---

## 填写说明

| 字段 | 说明 |
|------|------|
| `状态` | 固定值：`needs-triage`，由 `/issue-lifecycle` 管理流转 |
| `分类` | `enhancement` / `bug` / `refactor` |
| `规格引用` | 生成 issue 时先留空，spec 编写后回填 |
| `验收标准` | 可验证的完成条件，每条必须能回答"怎么验证" |
| `阻塞于` | 必须先完成的 issue，没有则写 "无" |
| `范围外` | 明确排除的内容，防止范围蔓延 |
