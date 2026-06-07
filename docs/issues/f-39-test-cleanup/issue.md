---
id: f-39
status: open
track: frontend
priority: p2
summary: 测试迁移（Vue Test Utils → RTL + alova hooks 测试覆盖）+ E2E 适配（Playwright 选择器更新）+ 删除 packages/webui + 构建/类型检查验证 + 文档更新
blocked_by:
  - f-38
checklist: checklist.json
plan: plan.md
specs: specs/
prd: docs/prd/v3-frontend-migration.md
prd_section: §5.5 阶段五：测试与打磨 + §6.7 alova 测试策略
---

## 要构建的内容

迁移收尾阶段：将 Vue Test Utils 测试迁移为 React Testing Library 测试；按 §6.7 的两层测试策略覆盖 alova hooks 的重点场景（P0: loading/data/error 状态流转、P1: debounce/fetcher/pagination/token 刷新、P2: 缓存命中）；适配 Playwright E2E 脚本的选择器（Vue → React）；删除 `packages/webui` 旧代码；更新开发脚本文档；运行全量 type-check + build 验证通过。

## 规格引用

- 功能规格: specs/feature-spec.md
- 行为规格: specs/behavior-spec.md

## PRD 引用

- **来源 PRD**: docs/prd/v3-frontend-migration.md
- **对应章节**: §5.5 阶段五：测试与打磨 + §6.7 alova 测试策略
- **核心目标**: 单元测试迁移（Vue Test Utils → RTL）；E2E 测试适配（选择器更新）；`pnpm type-check` 全量通过；`pnpm build` 产物正常；删除旧代码 `packages/webui`
- **验收标准**: `pnpm test` 单元测试通过；`pnpm test:e2e` 核心流程通过；`pnpm type-check` 无类型错误；删除 `packages/webui` 后不影响其他包

## 验收标准

- [ ] 单元测试迁移 — 将现有 Vue Test Utils `.spec.ts` 文件重写为 RTL `.spec.tsx`，覆盖原有业务逻辑
- [ ] alova hooks 测试 — P0 场景：loading → data 状态流转、error + send() 重试（mock `alova/client` hooks）
- [ ] alova hooks 测试 — P1 场景：useWatcher 防抖、useFetcher 手动 fetch()、usePagination 翻页、Token 刷新 401 重放
- [ ] alova hooks 测试 — P2 场景：缓存命中 fromCache
- [ ] Playwright E2E — 更新选择器从 Vue 专属 (`v-model`/`.vue-` class) 改为 React 通用选择器（`data-testid`/`role`/`aria-label`）
- [ ] `pnpm test:e2e` 核心流程通过（登录→Chat→KB→登出）
- [ ] `pnpm type-check` 全量无类型错误
- [ ] `pnpm build` 产物无错误
- [ ] 删除 `packages/webui/` 目录，更新 `pnpm-workspace.yaml` 移除引用
- [ ] 更新 `package.json` scripts（`dev:web` 指向 `@goferbot/web`）
- [ ] 参考资源：`docs/reference/alova-react-guide.md` §9 常见问题 + PRD §6.7 测试策略代码示例

## 阻塞于

- f-38: UI 组件库收尾与样式对齐（需要所有页面完成迁移后，才能进行最终测试验证）

## 范围外

- 不新增后端测试
- 不修改 Playwright 测试框架配置
- 不删除 `packages/admin/`（预留目录）
- 不修改 CI/CD 配置
