# Test Case 模板

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

---

## 覆盖检查

- [ ] 覆盖所有验收标准
- [ ] 覆盖所有错误场景
- [ ] 覆盖所有交互状态（loading/empty/error/success/partial）
- [ ] 每个错误场景有恢复路径验证
```

---

## Frontmatter 字段说明

| 字段 | 说明 | 必填 |
|------|------|------|
| `issue_id` | 对应 issue 编号 | ✅ |
| `type` | 固定值：`test-case` | ✅ |
| `kind` | 测试类别：behavior / api / e2e / unit | ✅ |
| `tc_count` | 测试用例总数 | 可选 |
| `status` | drafted → reviewed → automated | ✅ |
| `summary` | 清晰描述测试覆盖范围与核心场景，Agent 据此判断是否需深入阅读 | ✅ |

## 正文填写说明

| 字段 | 说明 |
|------|------|
| `TC-ID` | 格式：`TC-{issue-id}-{NNN}`，如 `TC-f-06-001` |
| `前置条件` | 测试执行前必须满足的环境/数据状态 |
| `步骤` | 可复现的操作序列 |
| `预期结果` | 明确的断言，避免模糊描述 |
| `优先级` | P0（阻塞）/ P1（重要）/ P2（可选） |
