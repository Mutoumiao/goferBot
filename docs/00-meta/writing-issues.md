# Issue 编写规范

> 双轨前缀 + 垂直切片，每个 Issue 是一个可独立交付的端到端功能单元

---

## 目录结构

```
docs/02-issues/
├── _template.md
├── f-03-knowledge-base-list.md
├── f-05-file-upload-component.md
├── b-05-knowledge-base-crud-api.md
└── ...
```

---

## 文件命名

```
{prefix}-{NN}-{kebab-case-slug}.md
```

**前缀规则：**

| 前缀 | 轨道 | 示例 |
|------|------|------|
| `f-XX` | 前端功能 | `f-05-file-upload-component` |
| `b-XX` | 后端接口 | `b-07-document-upload-api` |
| `d-XX` | 设计 | `d-02-design-system-tokens` |
| `i-XX` | 基础设施 | `i-01-docker-compose-setup` |
| `q-XX` | 质量 | `q-01-e2e-test-framework` |

**编号规则：**
- 每条轨道独立编号，从 01 开始
- 已关闭的 Issue 编号不重复使用

---

## Issue 模板

```markdown
状态: needs-triage
分类: enhancement

## 要构建的内容

{垂直切片的简洁描述}

## 规格引用

- 功能规格: docs/03-specs/features/{feature-slug}/feature-spec.md
- 行为规格: docs/03-specs/features/{feature-slug}/behavior-spec.md
- API 规格: docs/03-specs/features/{feature-slug}/api-spec.md

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

## 垂直切片规则

- 每个切片交付一条**完整**的端到端路径（schema → API → UI → tests）
- 完成的切片可独立演示或验证
- 优先薄切片，避免厚切片
- 每个切片必须有对应的规格目录

## HITL vs AFK

| 类型 | 说明 | 偏好 |
|------|------|------|
| HITL | 需要人工交互（架构决策、设计评审） | 尽量少 |
| AFK | 可自动实现、测试、合并 | 优先 |

---

## 状态流转

```
needs-triage → triaged → in-progress → in-review → closed
                    ↓
                 blocked
```

- `needs-triage`: 刚创建，待分类
- `triaged`: 已分配轨道和优先级
- `in-progress`: 正在实现
- `in-review`: 代码/spec 对齐审查中（使用 `/kb-review`）
- `blocked`: 被其他 Issue 阻塞
- `closed`: 已完成并验证（通过 `/kb-review` 验收）
