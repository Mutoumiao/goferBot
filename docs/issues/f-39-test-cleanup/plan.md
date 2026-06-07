---
id: f-39
issue: issue.md
version: 1
---

# 测试迁移与旧代码清理 实现计划

**目标：** 测试体系迁移（Vue → RTL + alova）+ E2E 适配 + 删除 webui + 全量验证

**PRD 引用：** §5.5 + §6.7

---

## ADR 合规声明

| ADR | 涉及内容 | 符合 |
|-----|---------|------|
| ADR 0001 | 测试框架 | ✅ Vitest + RTL 为批准的技术栈 |

---

## 任务列表

### 任务 1: alova P0 测试（loading/data/error + 重试）
- [ ] RED → GREEN：mock `alova/client`，测组件三态渲染 + `send()` 重试

### 任务 2: alova P1 测试（debounce/fetcher/pagination/token）
- [ ] RED → GREEN：`useWatcher` 防抖、`useFetcher` 手动 fetch、`usePagination` 翻页、Token 刷新 401 重放

### 任务 3: alova P2 测试（缓存命中）
- [ ] RED → GREEN：二次请求 fromCache，不触发网络

### 任务 4: 单元测试迁移（Vue → RTL）
- [ ] RED → GREEN：重写现有 Vue Test Utils 测试为 RTL

### 任务 5: Playwright E2E 适配 + 删除 webui
- [ ] 选择器更新为 `data-testid`/`role`/`aria-label` → `pnpm test:e2e` 通过
- [ ] 删除 `packages/webui/` → 更新 workspace → 验证 `pnpm build`

### 任务 6: 全量验证 + 文档更新
- [ ] `pnpm type-check` + `pnpm build` + `pnpm test` + 文档更新
