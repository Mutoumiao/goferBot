# Issue 模板

```markdown
---
id: f-15
status: open
track: frontend
priority: p1
summary: {简洁描述功能目标与范围，2-3 句话，足够让 Agent 判断相关性}
blocked_by: []
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

{垂直切片的简洁描述，不超过 3 句话}

## 规格引用

- 功能规格: specs/feature-spec.md
- 行为规格: specs/behavior-spec.md
- API 规格: specs/api-spec.md

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

## Frontmatter 字段说明

| 字段 | 说明 | 必填 |
|------|------|------|
| `id` | Issue 编号，如 `f-15` | ✅ |
| `status` | `open` / `in-progress` / `closed`，由 checklist 推导 | ✅ |
| `track` | 轨道：frontend / backend / design / infra / quality | ✅ |
| `priority` | 优先级：p0（阻塞）/ p1（重要）/ p2（可选） | ✅ |
| `summary` | 清晰描述功能目标与范围，Agent 据此判断是否需深入阅读 | ✅ |
| `blocked_by` | 阻塞此 issue 的其他 issue ID 列表 | 可选 |
| `checklist` | 指向 checklist.json 的相对路径 | ✅ |
| `plan` | 指向 plan.md 的相对路径 | ✅ |
| `specs` | 指向 specs 目录的相对路径 | ✅ |

## 正文字段说明

| 字段 | 说明 |
|------|------|
| `要构建的内容` | 垂直切片描述 |
| `规格引用` | 生成 issue 时先留空，spec 编写后回填 |
| `验收标准` | 可验证的完成条件，每条必须能回答"怎么验证" |
| `阻塞于` | 必须先完成的 issue，没有则写 "无" |
| `范围外` | 明确排除的内容，防止范围蔓延 |
