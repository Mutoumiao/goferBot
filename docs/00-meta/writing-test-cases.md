# Test Case 编写规范

> 测试用例是验收标准的可执行化表达。
> 每个测试用例必须可追溯到一个 issue 和一个 spec。

---

## 目录结构

```
docs/08-test-cases/
└── {issue-id}/
    └── {kind}.md
```

| 元素 | 规则 |
|------|------|
| `issue-id` | 与 issue 编号完全一致 |
| `kind` | 测试类别：behavior / api / e2e / unit |

---

## Kind 枚举

| Kind | 含义 | 适用场景 |
|-------|------|----------|
| `behavior` | 行为测试用例 | 前端交互、UI 状态、用户操作流程 |
| `api` | API 测试用例 | 后端接口、请求/响应、错误码 |
| `e2e` | 端到端测试用例 | 完整用户旅程、前后端联调 |
| `unit` | 单元测试用例 | 纯函数、工具类、独立模块 |

---

## 规则

- 目录名 = issue 编号
- 一个 issue 可包含多个 kind 文件
- 优先写 `behavior.md` 或 `api.md`
- 跨端集成场景写 `e2e.md`
- 复杂后端逻辑补充 `unit.md`

---

## 模板

```markdown
---
issue_id: {issue-id}
type: test-case
kind: {behavior / api / e2e / unit}
tc_count: {N}
status: {drafted / reviewed / automated}
summary: {测试覆盖范围、核心场景、自动化状态，2-3 句话}
---

# {issue-id} {kind} 测试用例

> 对应 issue: `docs/02-issues/{issue-id}-{slug}.md`
> 规格引用:
> - `docs/03-specs/{issue-id}/feature-spec.md`
> - `docs/03-specs/{issue-id}/behavior-spec.md`
> - `docs/03-specs/{issue-id}/api-spec.md`
> - `docs/04-plans/{issue-id}/v1.md`

---

## 1. {功能模块} 测试

### TC-{issue-id}-{NNN}: {用例名称}

- **前置条件**: {执行测试前必须满足的条件}
- **步骤**:
  1. {具体操作}
  2. {具体操作}
- **预期结果**:
  - {具体断言}
  - {具体断言}
- **优先级**: P0 / P1 / P2

---

## 2. {功能模块} 测试

...

---

## 测试用例汇总

| TC-ID | 名称 | 优先级 | 类型 |
|-------|------|--------|------|
| TC-{issue-id}-001 | {名称} | P0 | API |
| TC-{issue-id}-002 | {名称} | P0 | API |
| TC-{issue-id}-003 | {名称} | P1 | 安全 |

---

## 覆盖检查

- [ ] 覆盖所有验收标准
- [ ] 覆盖所有错误场景
- [ ] 覆盖所有交互状态（loading/empty/error/success/partial）
- [ ] 每个错误场景有恢复路径验证
