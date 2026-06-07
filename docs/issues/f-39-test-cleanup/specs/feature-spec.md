# 功能规格：测试迁移与旧代码清理

> 状态：draft | 关联 issue：f-39 | PRD：§5.5 + §6.7

---

## 1. 目标

迁移测试体系：Vue Test Utils → RTL、alova hooks 两层测试覆盖（P0/P1/P2）、Playwright E2E 选择器更新、删除 packages/webui、全量 type-check + build 验证通过、文档更新。

---

## 2. 功能描述

### 2.1 单元测试迁移（Vue Test Utils → RTL）

- 将现有 `.spec.ts`（Vue Test Utils）重写为 `.spec.tsx`（React Testing Library）
- 覆盖原有业务逻辑：Store 测试、工具函数测试
- 新测试文件放在 `tests/unit/web/`

### 2.2 alova hooks 测试（两层策略）

参考 PRD §6.7：

| 层级 | 策略 | 测什么 |
|------|------|--------|
| 单元 | `vi.mock('alova/client')` | 组件 loading/data/error 渲染 |
| 集成 | 测试用 alova 实例 + Mock 适配器 | 完整请求→响应生命周期 |

**P0 场景**（5 个）：
- loading → data 状态流转
- error + send() 重试

**P1 场景**（4 个）：
- useWatcher 防抖
- useFetcher 手动 fetch()
- usePagination 翻页
- Token 刷新 401 重放

**P2 场景**（1 个）：
- 缓存命中 fromCache

### 2.3 Playwright E2E 适配

- 选择器从 Vue 专属（`v-model`、`.vue-*` class）改为通用选择器（`data-testid`、`role`、`aria-label`）
- 核心流程：登录 → Chat → KB → 登出

### 2.4 旧代码删除

- 删除 `packages/webui/`
- 更新 `pnpm-workspace.yaml` 移除引用
- 更新根 `package.json` scripts

---

## 3. 验收标准

| AC | 验收项 |
|----|--------|
| AC-01 | Vue Test Utils 测试已迁移为 RTL |
| AC-02 | alova P0 测试：loading/data/error + 重试 |
| AC-03 | alova P1 测试：debounce/fetcher/pagination/token |
| AC-04 | alova P2 测试：缓存命中 |
| AC-05 | Playwright 选择器已更新 |
| AC-06 | `pnpm test:e2e` 核心流程通过 |
| AC-07 | `pnpm type-check` 通过 |
| AC-08 | `pnpm build` 通过 |
| AC-09 | packages/webui 已删除 |
| AC-10 | 文档/脚本已更新 |
