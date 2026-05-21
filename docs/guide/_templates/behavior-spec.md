# 行为规格模板（前端）

```markdown
---
issue_id: f-15
type: behavior-spec
status: draft
summary: {覆盖的交互状态、核心流程、关键错误场景，2-3 句话}
---

# 行为规格：{功能名称}

## 入口

- 路由：{路径}
- 触发：{用户如何到达此功能}

## 初始状态

- {用户首先看到什么}

## 交互状态

| 状态 | 视觉 | 用户操作 | 系统响应 |
|-------|--------|-------------|-----------------|
| loading | {描述} | {禁用/启用} | {发生什么} |
| empty | {描述} | {可用操作} | {发生什么} |
| error | {描述} | {重试/取消} | {发生什么} |
| success | {描述} | {下一步} | {发生什么} |
| partial | {描述} | {可用操作} | {发生什么} |

## 正常流程

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|-------------|-----------------|--------------|
| 1 | {操作} | {响应} | {状态} |
| 2 | {操作} | {响应} | {状态} |

## 错误场景

| 场景 | 触发 | 视觉 | 恢复 |
|----------|---------|--------|----------|
| {错误 1} | {触发} | {视觉} | {如何恢复} |

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| loading 状态 | `tests/issues/f-15-global-tab-bar/TabBar.spec.ts` | `AC-01: renders TabBar in AuthenticatedLayout header` |
| 401 错误 | `tests/issues/f-15-global-tab-bar/TabBar.spec.ts` | `AC-02: displays error on unauthorized` |
```

---

## Frontmatter 字段说明

| 字段 | 说明 | 必填 |
|------|------|------|
| `issue_id` | 对应 issue 编号 | ✅ |
| `type` | 固定值：`behavior-spec` | ✅ |
| `status` | draft / review / approved / deprecated | ✅ |
| `summary` | 清晰描述交互范围与关键行为，Agent 据此判断是否需深入阅读 | ✅ |

## 关键规则

- 必须包含全部 5 种交互状态：loading / empty / error / success / partial
- 每个错误场景必须有恢复路径
- 底部必须包含**测试映射表**，链接到 `tests/issues/{issue-dir}/` 下的测试用例
- 不允许使用模糊词汇（"appropriate", "reasonable", "etc."）
