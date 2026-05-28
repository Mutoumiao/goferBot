# Plan 编写规范

> 执行计划是将 Spec 转化为可执行步骤的桥梁。
> 每个步骤必须具体到"打开哪个文件、写什么代码、运行什么命令验证"。

---

## 目录结构

```
docs/issues/{prefix}-{NN}-{kebab-slug}/
├── plan.md              # 当前生效版本
└── plans/               # 历史版本归档
    └── v{N}.md
```

- 当前生效版本固定为 `plan.md`
- 历史版本归档在 `plans/v{N}.md`，N 从 1 开始递增
- 禁止用时间戳或 `latest.md`

---

## 版本规则

| 场景 | 操作 |
|------|------|
| 首次生成计划 | 创建 `plan.md` |
| Spec 发生重大变更 | 保留原 `plan.md` 到 `plans/v1.md`，新建 `plan.md` |
| 审查后需大规模重构 | 保留当前版本到 `plans/v{N}.md`，新建 `plan.md` |
| 执行中发现方案不可行 | 保留当前版本到 `plans/v{N}.md`，新建 `plan.md` |

---

## 模板

```markdown
---
id: f-15
issue: issue.md
version: 1
---

## 任务 1: 迁移 TabBar 组件

**文件**：
- 修改：`packages/webui/src/layouts/AuthenticatedLayout.vue`
- 修改：`packages/webui/src/views/ChatView.vue`
- 测试：`tests/unit/webui/TabBar.spec.ts`

**规格引用**：
- behavior-spec.md 第 3.1 节

- [ ] **步骤 1: 编写失败测试**

```typescript
it('AC-01: renders TabBar in AuthenticatedLayout header', () => {
  const wrapper = mount(AuthenticatedLayout)
  expect(wrapper.find('[data-testid="tab-bar"]').exists()).toBe(true)
})
```

- [ ] **步骤 2: 运行测试确认失败**
- [ ] **步骤 3: 编写最小实现**
- [ ] **步骤 4: 运行测试确认通过**
```

---

## 关键规则

### 步骤粒度

- 每个步骤应在 **2~5 分钟** 内完成
- 一个任务不超过 **8 个步骤**
- 超过 8 步应拆分为多个任务

### TDD 强制

- 每个任务必须以"编写失败测试"开始
- 以"运行测试确认通过"结束
- 测试文件按层级放在对应目录下（`tests/unit/`、`tests/integration/`、`tests/e2e/`）

### 代码示例

- 每个涉及编码的步骤必须包含**完整可运行的代码片段**
- 禁止用 "实现 X 功能" 这种模糊描述
- 必须指明文件路径和插入位置

### 验证命令

- 每个任务末尾必须包含**验证命令**
- 验证命令必须有**预期输出**
- 优先使用自动化验证（类型检查、测试）

### 禁止事项

| 禁止 | 错误示例 | 正确示例 |
|------|----------|----------|
| 占位符 | "TODO: 实现登录逻辑" | 完整的登录逻辑代码 |
| 模糊步骤 | "配置路由" | "在 `router/index.ts` 第 15 行添加 `{ path: '/login', component: LoginView }`" |
| 无验证 | 任务结束无验证步骤 | "运行 `pnpm type-check`，预期 PASS" |
| 跨 issue 编码 | 在 f-15 计划中修改 b-02 的代码 | 只修改 f-15 范围内的文件 |
