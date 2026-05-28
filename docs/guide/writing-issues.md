# Issue 编写规范

> Issue-Centric 结构：一个 issue 一个目录，包含 `issue.md` + `plan.md` + `checklist.json` + `specs/`

---

## 目录结构

```
docs/issues/
└── {prefix}-{NN}-{kebab-slug}/
    ├── issue.md         # 项目管理卡片（frontmatter + 正文）
    ├── plan.md          # 当前生效执行计划
    ├── plans/           # 历史版本归档
    │   └── v{N}.md
    ├── checklist.json   # 验收状态（机器写，人可读）
    └── specs/           # 技术契约
        ├── feature-spec.md
        ├── behavior-spec.md
        └── api-spec.md
```

---

## issue.md

项目管理卡片。人写，机器读 frontmatter。

```markdown
---
id: f-15
status: closed
track: frontend
priority: p1
summary: TabBar 提升至全局导航，标签驱动 RouterView 切换
blocked_by: [f-14]
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 补充说明

TabBar 迁移涉及全局路由逻辑变更，需确保 f-14 Store 已合并后再启动。
```

### Frontmatter 字段

| 字段         | 来源 | 说明                                                    |
|--------------|------|---------------------------------------------------------|
| `id`         | 人工 | 目录名前缀，如 `f-15`                                   |
| `status`     | 机器 | `open` / `in-progress` / `closed`，由 checklist 推导    |
| `track`      | 人工 | `frontend` / `backend` / `design` / `infra` / `quality` |
| `priority`   | 人工 | `p0` / `p1` / `p2`                                      |
| `blocked_by` | 人工 | 阻塞本 issue 的 ID 列表                                 |
| `checklist`  | 人工 | 指向 checklist.json 的相对路径                          |
| `plan`       | 人工 | 指向 plan.md 的相对路径                                 |
| `specs`      | 人工 | 指向 specs 目录的相对路径                               |

### 状态推导规则

| checklist 状态           | issue status  |
|--------------------------|---------------|
| 全部 `pass`              | `closed`      |
| 有 `fail`                | `in-progress` |
| 有 `pending` 且无 `fail` | `open`        |

---

## checklist.json

验收状态。机器写，人可读。

```json
{
  "issue_id": "f-15",
  "version": 1,
  "updated_at": "2026-05-20T14:30:00Z",
  "items": [
    {
      "id": "AC-01",
      "desc": "TabBar 迁入 AuthenticatedLayout header",
      "status": "pass",
      "test_file": "tests/unit/webui/TabBar.spec.ts",
      "test_case": "AC-01: renders TabBar in AuthenticatedLayout header"
    },
    {
      "id": "AC-07",
      "desc": "审查记录归档到 docs/reviews/",
      "status": "pending",
      "manual": true
    }
  ]
}
```

### 字段说明

| 字段        | 说明                                      |
|-------------|-------------------------------------------|
| `id`        | AC-XX 格式，与测试用例名对应              |
| `desc`      | 验收项描述                                |
| `status`    | `pending` / `pass` / `fail`               |
| `test_file` | 对应测试文件路径（可选，manual 项可省略） |
| `test_case` | 测试用例全名（可选）                      |
| `manual`    | `true` 表示无自动化测试，需人工标记       |

---

## 垂直切片规则

- 每个切片交付一条**完整**的端到端路径（schema → API → UI → tests）
- 完成的切片可独立演示或验证
- 优先薄切片，避免厚切片

## HITL vs AFK

| 类型 | 说明                               | 偏好   |
|------|------------------------------------|--------|
| HITL | 需要人工交互（架构决策、设计评审） | 尽量少 |
| AFK  | 可自动实现、测试、合并             | 优先   |
