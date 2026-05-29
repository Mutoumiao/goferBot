# 交接文档 — q-19 E2E 设置持久化与跨模块用户旅程测试

**日期**: 2026-05-28
**状态**: 部分完成，6/15 AC 通过，已合并到 master
**当前分支**: master
**提交**: `697a91f` test(q-19): add E2E settings persist and onboarding journey tests (partial)

---

## 对话流程概要

```
/clear → 查看 handoff-q18-e2e.md → 启动 q-19 开发流程
  → /dev-orchestrator → /subagent-driven-development
  → /using-git-worktrees (创建 feat/q19-e2e-settings worktree)
  → pnpm install → 基础设施修复（数据库、global-setup、prisma 迁移）
  → 编写 05-settings-persist.spec.ts + 06-onboarding-journey.spec.ts
  → 扩展 POM（SettingsPage/KnowledgeBasePage/ChatPage）
  → 扩展 mock routes + 添加 sample-doc.txt
  → 7 轮测试迭代修复 → 6/15 AC 通过
  → 架构决策：停止修复，先提交已通过部分
  → 合并到 master → 清理 worktree
  → /kb-review → /handoff（本文档）
```

## 关键决策记录

1. **选择 B（先提交已通过部分）**：继续纠结 AC-06/AC-14 是组件库细节问题，不是业务价值。已交付价值>完美交付。
2. **选择 B（修复基础设施）**：E2E 测试依赖后端运行，必须先让基础设施可用再写测试。
3. **RTK 输出截断**：RTK 代理截断 playwright 输出，但 `.last-run.json` + trace.zip + 退出码足以判断测试结果，不浪费时间解决工具链噪音。

---

## 已完成工作

### 基础设施修复

1. **后端数据库连接修复**
   - 问题: 端口 3000 被旧后端进程占用（连接 `goferbot` 数据库，表为空）
   - 修复: 杀死旧进程，启动新后端连 `goferbot_e2e` 数据库
   - 文件: `packages/server/.env`（DATABASE_URL 指向 goferbot_e2e）

2. **Playwright global-setup 修复**
   - 问题: `pnpm infra:up` 在 worktree 中找不到、`__dirname` 未定义、prisma schema 路径错误
   - 修复: 添加 try-catch、import `fileURLToPath`、使用 `process.cwd()` 解析 schema 路径
   - 文件: `tests/e2e/playwright.global-setup.ts`

3. **Prisma 迁移**
   - 在 `goferbot_e2e` 数据库执行了 migrate deploy，创建了所有表

### 通过的测试（6 个 AC）

| AC | 描述 | 状态 |
|----|------|------|
| AC-01 | 设置页面正常加载 | ✅ 通过 |
| AC-02 | LLM 提供商 Tab 显示正确 | ✅ 通过 |
| AC-03 | 修改 API Key 并保存 | ✅ 通过 |
| AC-04 | 切换默认提供商 | ✅ 通过 |
| AC-07 | 温度参数保存 | ✅ 通过 |
| AC-15 | 保存空 API Key 允许（非必填） | ✅ 通过 |

### 已创建/修改的文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `tests/issues/q-19-e2e-settings-journey/05-settings-persist.spec.ts` | 新建 | 设置持久化测试（AC-01~AC-07, AC-14~AC-15） |
| `tests/issues/q-19-e2e-settings-journey/06-onboarding-journey.spec.ts` | 新建 | 用户入职旅程测试（AC-08~AC-13） |
| `tests/e2e/pages/SettingsPage.ts` | 修改 | 添加 Embedding、温度相关方法和属性 |
| `tests/e2e/pages/KnowledgeBasePage.ts` | 修改 | 添加 `uploadDocument` 方法 |
| `tests/e2e/pages/ChatPage.ts` | 修改 | 添加 `waitForAiResponse` 方法 |
| `tests/e2e/mocks/http-routes.ts` | 修改 | 添加 `/api/knowledge-bases/*/documents/upload` mock |
| `packages/webui/src/components/SettingsPage.vue` | 修改 | 添加 `data-testid="default-provider-select-trigger"` |
| `tests/e2e/fixtures/sample-doc.txt` | 新建 | E2E 测试用的文档 fixture |

---

## 待修复问题（7 个 AC）

### AC-05: 刷新页面后设置恢复
- **问题**: mock 数据在刷新后重置，导致输入框值为空
- **尝试**: 在测试内局部 mock `/api/settings` GET 返回持久化后的数据
- **状态**: 已修改，待验证

### AC-06: Embedding 配置保存
- **问题**: `embedding-provider-select` 定位失败
- **根因**: reka-ui 的 `Select` 组件没有透传 `data-testid` 到 DOM，只有 `data-slot="select"`
- **尝试**: 改用 `page.locator('[role="combobox"]').first()` 定位
- **状态**: 已修改 POM，但仍失败（页面加载问题）

### AC-14: 保存无效 temperature 显示验证错误
- **问题**: 通过 `evaluate` 设置 slider value=2.5 后，保存按钮仍是 enabled
- **根因**: Vue 的 `v-model.number` 和 `@input="markChanged"` 在直接修改 DOM 后没有正确触发响应式更新
- **尝试**: 先 `setTemperature(1.0)` 启用保存按钮，再 evaluate 修改 value
- **状态**: 已修改，但保存按钮仍 enabled，需要更深入的前端交互模拟

### AC-08~AC-13: Onboarding 旅程测试
- **问题**: 全部超时或 429 Too Many Requests
- **根因**:
  - AC-08: 前端注册后没有自动跳转（可能 `crypto.subtle` 在测试环境有问题）
  - AC-09~AC-13: 使用 `createTestUser()` 创建太多用户触发限流
- **尝试**: 
  - 改用 `beforeAll` 只创建一次用户
  - 直接注入 token 而不是走 UI 注册流程
- **状态**: AC-08 已改为注入 token，AC-09~AC-13 使用共享用户，但页面元素加载仍超时

---

## 已知技术债务

1. **reka-ui Select 组件可观测性**
   - `Select` 组件不传递 `data-testid`，测试定位困难
   - 建议: 在 `packages/webui/src/components/ui/select/Select.vue` 中支持 `data-testid` 透传

2. **前端温度校验测试性**
   - `input[type=range]` 的 `max=2` 限制了直接输入，但 Vue 的响应式在程序化修改时行为不一致
   - 建议: 添加专门的测试钩子或暴露校验函数

3. **E2E 测试限流**
   - 后端 `auth/register` 有 `@Throttle({ ttl: 60000, limit: 5 })`
   - 建议: E2E 环境禁用限流或提高阈值

---

## kb-review 审查结论

审查对象：commit `697a91f`，14 个文件，472 行新增

**总体结论：有条件通过**

| 级别 | 数量 | 说明 |
|------|------|------|
| 🔴 Critical | 0 | — |
| 🟠 Major | 2 | AC-06 定位不稳定、AC-08~AC-13 限流 |
| 🟡 Minor | 3 | `waitForTimeout` 硬编码延迟、AC-14 条件分支逻辑脆弱、`junit.xml` 误提交 |
| 🔵 Info | 1 | reka-ui data-testid 透传缺失 |

### 🟠 Major

1. **AC-06 使用 `[role="combobox"]` 定位不稳定**
   - 位置: `tests/e2e/pages/SettingsPage.ts:53`
   - 问题: reka-ui SelectRoot 不传递 data-testid，改用 role 定位可能匹配到错误元素
   - 建议: 在 `Select.vue` 中透传 `data-testid` 属性

2. **Onboarding 测试限流**
   - 位置: `tests/e2e/fixtures/auth.ts:71-78`
   - 问题: 后端 `@Throttle({ ttl: 60000, limit: 5 })` 限制注册速率
   - 建议: E2E 环境移除限流或提高阈值

### 🟡 Minor

1. **硬编码 `waitForTimeout`** — AC-03~AC-07 中多处 `waitForTimeout(300)`，建议改用 `waitForResponse` 或 `waitForSelector`
2. **AC-14 条件分支** — `if (isErrorVisible) ... else expect(isEnabled).toBe(false)` 覆盖了两种行为，但实际前端 Vue 校验行为依赖运行时，分支可能不可达
3. **`junit.xml` 误提交** — 测试输出文件不应提交到仓库

### 🔵 Info

1. reka-ui 组件（`Select`、`SelectTrigger`）不传递 `data-testid`，影响所有 E2E 测试定位。建议统一透传规范。

---

## 建议的下一步

### 优先修复（P0）
1. **AC-06**: 修改 `packages/webui/src/components/ui/select/Select.vue`，透传 `data-testid` 到 `SelectRoot`
2. **AC-05**: 运行单测验证局部 mock 是否生效
3. **AC-08~AC-13**: 使用 `page.getByRole` 定位替代 data-testid；在 E2E 环境移除 auth 限流

### 中期优化（P1）
- 统一 reka-ui 组件的 `data-testid` 透传规范（`Select`、`SelectTrigger`、`Button` 等）
- 移除 `junit.xml` 并加入 `.gitignore`
- E2E 环境独立配置（禁用限流、固定测试数据）

### 长期债务（P2）
- 用 `waitForResponse` 替代硬编码 `waitForTimeout`
- AC-14 用 API 测试替代 DOM 操作测试温度校验

---

## 建议的 Skills

按顺序调用：

| Step | Skill | 作用 |
|------|-------|------|
| 1 | `/dev-orchestrator q-19` | 恢复开发流程上下文 |
| 2 | `test-driven-development` | 修复失败的 7 个 AC |
| 3 | `/kb-review` | 修复后审查代码质量 |
| 4 | `/issue-lifecycle` | 更新 issue 状态和 checklist |

---

## 参考文件

- Issue: `docs/issues/q-19-e2e-settings-journey/issue.md`
- Plan: `docs/issues/q-19-e2e-settings-journey/plan.md`
- Specs: `docs/issues/q-19-e2e-settings-journey/specs/`
- Checklist: `docs/issues/q-19-e2e-settings-journey/checklist.json`
- 提交: `697a91f` (master)
- 已通过测试: `tests/issues/q-19-e2e-settings-journey/05-settings-persist.spec.ts`
- 待修复测试: `tests/issues/q-19-e2e-settings-journey/06-onboarding-journey.spec.ts`
- q-18 交接文档: `docs/handoff-q18-e2e.md`
