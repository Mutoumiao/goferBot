---
name: spec-validator
description: >
  对 spec 进行 relentless 质询，挑战其与领域模型的兼容性，精炼术语。
  当用户说"审查 spec"、"spec 对吗"、"帮我写 behavior spec"时触发。
  输出路径：docs/03-specs/{issue-id}/
---

# Spec 验证器

毫不留情地向我质询此 spec 的每个方面，直到达成共同理解。一次只问一个问题，等待反馈后再继续。如果问题可通过探索代码库回答，那就探索代码库。

---

## 会前阅读

1. **PRD**: `docs/01-prd/v2-cloud-native.md`
2. **架构规格**: `docs/03-specs/architecture/v2-cloud-native.md`
3. **相关 Specs**: `docs/03-specs/{related-issue-id}/`
4. **ADRs**: `docs/05-adrs/`
5. **设计系统**: `docs/06-design/system/DESIGN.md`
6. **命名规范**: `docs/00-meta/naming-convention.md`

---

## 会话期间

### 挑战术语表

当用户术语与 PRD 或架构规格冲突时，立即指出。

> "你的 PRD 将 'knowledge base' 定义为 X，但你似乎指的是 Y —— 到底是哪个？"

### 精炼模糊语言

当用户使用模糊术语时，提出精确规范术语。

> "你说 'upload' —— 是指用户选择文件、HTTP 传输，还是后端保存到 MinIO？"

### 讨论具体场景

用边界情况场景对领域关系进行压力测试，迫使用户精确概念界限。

### 与代码交叉验证

当用户陈述某物如何工作时，检查代码是否同意。发现矛盾时提出来。

---

## Spec 输出模板

### 路径验证（强制执行）

生成 spec 前必须确认：
- 对应 issue 存在于 `docs/02-issues/{issue-id}-{slug}.md`
- spec 目录名必须与 issue 编号一致（如 `f-06`）
- **禁止**用 feature-slug（如 `knowledge-base-file-manager`）作为目录名
- 目录路径：`docs/03-specs/{issue-id}/`

### 功能规格

保存到：`docs/03-specs/{issue-id}/feature-spec.md`

```markdown
# 功能规格：{功能名称}

## 用户故事
作为 {用户类型}，我希望 {操作}，以便 {收益}。

## 边界
- 范围内：{包含的内容}
- 范围外：{明确排除的内容}

## 涉及页面/组件
- {页面/组件 1}
- {页面/组件 2}

## 相关功能
- {上游功能} — 提供 {什么}
- {下游功能} — 消费 {什么}

## 已做决策
| 决策 | 理由 | 可逆？ |
|------|------|--------|
| {决策 1} | {原因} | {是/否} |
```

### 行为规格（前端）

保存到：`docs/03-specs/{issue-id}/behavior-spec.md`

```markdown
# 行为规格：{功能名称}

## 入口
- 路由：{路径}
- 触发：{用户如何到达此功能}

## 初始状态
- {用户首先看到什么}

## 交互状态

| 状态 | 视觉 | 用户操作 | 系统响应 |
|------|------|----------|----------|
| loading | {描述} | {禁用/启用} | {发生什么} |
| empty | {描述} | {可用操作} | {发生什么} |
| error | {描述} | {重试/取消} | {发生什么} |
| success | {描述} | {下一步} | {发生什么} |
| partial | {描述} | {可用操作} | {发生什么} |

## 正常流程
| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | {操作} | {响应} | {状态} |
| 2 | {操作} | {响应} | {状态} |

## 错误场景
| 场景 | 触发 | 视觉 | 恢复 |
|------|------|------|------|
| {错误 1} | {触发} | {视觉} | {如何恢复} |

## 动画与过渡
| 过渡 | 持续时间 | 缓动 | 备注 |
|------|----------|------|------|
| {过渡 1} | {毫秒} | {ease-in-out} | {备注} |

## 无障碍
- 键盘导航：{tab 顺序、快捷键}
- 屏幕阅读器：{ARIA 标签、实时区域}
- 触摸目标：{最小尺寸}

## 响应式行为
| 断点 | 布局变化 |
|------|----------|
| 375px | {变化} |
| 768px | {变化} |
| 1440px | {变化} |

## 测试映射（新增）

| 交互状态 | 测试文件 | 测试用例 |
|----------|----------|----------|
| loading | `packages/webui/src/.../*.spec.ts` | `it('shows loading during submit')` |
| error | `packages/webui/src/.../*.spec.ts` | `it('displays error message on failure')` |
| success | `packages/webui/src/.../*.spec.ts` | `it('redirects to home after success')` |
```

### API 规格（后端）

保存到：`docs/03-specs/{issue-id}/api-spec.md`

```markdown
# API 规格：{功能名称}

## 端点

### POST /api/{资源}

#### 认证
{Bearer Token / 无 / 等}

#### 请求
```json
{
  "field": "type (constraints)"
}
```

#### 响应 200/201
```json
{
  "field": "type"
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | {场景} | `{ "error": "..." }` |
| 409 | {场景} | `{ "error": "..." }` |

#### 异步行为
- {异步发生什么}
- {客户端如何轮询状态}

## 测试映射（新增）

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| 正常请求 | `packages/server/src/.../*.spec.ts` | `it('returns 200 with valid input')` |
| 参数错误 | `packages/server/src/.../*.spec.ts` | `it('returns 400 for invalid input')` |
| 未授权 | `packages/server/src/.../*.spec.ts` | `it('returns 401 without token')` |
```

---

## 内联更新规则

- 术语或决策解决时，**立即**更新 spec 文件，不要批量处理
- 不要将 spec 与实现细节耦合，只包含对领域专家有意义的术语

### 谨慎提供 ADR

仅当三点全部为真时才创建 ADR：

1. **难以逆转** — 改变主意的成本是实质性的
2. **没有上下文会令人惊讶** — 未来读者会想知道"为什么这样做？"
3. **真实权衡的结果** — 存在真正的替代方案，出于特定原因选择了其中一个

保存到 `docs/05-adrs/NNNN-{slug}.md`。

---

## 完成检查清单

- [ ] 功能规格有清晰的用户故事和边界
- [ ] 行为规格包含全部 5 种交互状态（loading/empty/error/success/partial）
- [ ] 行为规格有带恢复路径的错误场景
- [ ] API 规格有所有端点及请求/响应示例
- [ ] API 规格有所有错误码及场景
- [ ] **行为规格包含测试映射表格（测试文件路径 + 用例名）**
- [ ] **API 规格包含测试映射表格（测试文件路径 + 用例名）**
- [ ] 无模糊术语残留（"appropriate"、"reasonable"、"etc."）
- [ ] 所有决策都有理由记录
- [ ] Spec 目录名与 issue 编号一致（如 `f-06`）
- [ ] 禁止用 feature-slug 作为目录名
- [ ] 三个 spec 文件至少存在一个（按 issue 类型）
