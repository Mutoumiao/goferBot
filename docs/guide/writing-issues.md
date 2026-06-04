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

## 模板

模板文件：[`_templates/issue.md`](./_templates/issue.md)

---

## checklist.json

验收状态。机器写，人可读。

```json
{
  "issue_id": "{prefix}-{NN}",
  "version": 1,
  "updated_at": "{YYYY-MM-DDTHH:mm:ssZ}",
  "items": [
    {
      "id": "AC-01",
      "desc": "{验收项描述}",
      "status": "pass",
      "test_file": "tests/{layer}/{name}.spec.ts",
      "test_case": "AC-01: {测试用例描述}"
    },
    {
      "id": "AC-07",
      "desc": "{验收项描述}",
      "status": "pending",
      "manual": true
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `id` | AC-XX 格式，与测试用例名对应 |
| `desc` | 验收项描述 |
| `status` | `pending` / `pass` / `fail` |
| `test_file` | 对应测试文件路径（可选，manual 项可省略） |
| `test_case` | 测试用例全名（可选） |
| `manual` | `true` 表示无自动化测试，需人工标记 |

### 状态推导规则

| checklist 状态 | issue status |
|----------------|--------------|
| 全部 `pass` | `closed` |
| 有 `fail` | `in-progress` |
| 有 `pending` 且无 `fail` | `open` |

---

## 垂直切片规则

- 每个切片交付一条**完整**的端到端路径（schema → API → UI → tests）
- 完成的切片可独立演示或验证
- 优先薄切片，避免厚切片

## HITL vs AFK

| 类型 | 说明 | 偏好 |
|------|------|------|
| HITL | 需要人工交互（架构决策、设计评审） | 尽量少 |
| AFK | 可自动实现、测试、合并 | 优先 |
