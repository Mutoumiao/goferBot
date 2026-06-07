---
id: f-33
status: open
track: frontend
priority: p0
summary: 建立 apps/web 完整鉴权链路 — alova 实例（含 Token 刷新队列）+ packages/data/ auth Zod schema + Zustand auth Store + login/register 页面 + TanStack Router 路由守卫，实现登录→跳转→token 刷新端到端闭环
blocked_by:
  - i-32
checklist: checklist.json
plan: plan.md
specs: specs/
prd: docs/prd/v3-frontend-migration.md
prd_section: §5.2 阶段二 + §6.1 鉴权方案 + §6.6 前后端类型共享
---

## 要构建的内容

从零搭建 apps/web 的鉴权基础设施：创建 alova 实例（baseURL、Token 注入、Token 刷新队列机制在 `responded.onError` 中处理 401）、创建 `packages/data/` 共享包（auth 域 Zod schema + `z.infer` 类型）、创建 Zustand auth Store（登录状态/Token 管理/持久化）、实现 login/register 页面、在 TanStack Router `beforeLoad` 中实现路由守卫。完成后可独立验证：登录页 → 输入凭据 → 跳转首页 → 刷新不丢失 → Token 过期自动刷新。

## 规格引用

- 功能规格: specs/feature-spec.md
- 行为规格: specs/behavior-spec.md
- API 规格: specs/api-spec.md

## PRD 引用

- **来源 PRD**: docs/prd/v3-frontend-migration.md
- **对应章节**: §5.2 阶段二：核心能力迁移 + §6.1 鉴权方案 + §6.6 前后端类型共享
- **核心目标**: 迁移鉴权、布局、核心页面；Token 自动刷新在 `utils/server.ts` 的 alova `responded.onError` 中实现；创建 `packages/data/` 先把 auth 域 Schema 提过去，验证前后端链路
- **验收标准**: 登录/注册流程正常；鉴态状态持久化（刷新不丢失）；路由守卫正确拦截未认证用户；Token 刷新逻辑集中在 alova 实例层，对业务组件透明

## 验收标准

- [ ] `apps/web/app/utils/server.ts` — alova 实例创建完成，包含 `beforeRequest`（Token 注入）、`responded.onSuccess`（`{ data: T }` 解包）、`responded.onError`（400→业务错误抛出、401→Token 刷新队列、其他→网络错误）
- [ ] Token 刷新机制：`isRefreshing` 防并发 + `refreshSubscribers` 重放队列 + 刷新失败清除 Token 跳 `/login`
- [ ] `packages/data/` 包存在，`src/schemas/auth.schema.ts` 定义 `loginRequestSchema`/`loginResponseSchema`，`src/types/index.ts` 通过 `z.infer` 导出 TS 类型
- [ ] `apps/web/app/api/auth.ts` — `login()`/`register()`/`getMe()` 方法，参数与返回值类型来自 `@goferbot/data`
- [ ] Zustand auth Store — `create<AuthStore>` 管理 `user`/`token`/`isAuthenticated`，localStorage 持久化
- [ ] `/login` 页面 — 登录表单，使用 alova `useRequest`，loading/error 状态完整，成功后跳转 `/app`
- [ ] `/register` 页面 — 注册表单（可选在 scope 内）
- [ ] 路由守卫 — `/app` 布局路由 `beforeLoad` 中检查 auth 状态，未认证重定向 `/login`
- [ ] 参考资源：`docs/reference/alova-react-guide.md` 实例配置 + Token 刷新 + hooks 用法；`docs/reference/tanstack-start-guide.md` 路由守卫 `beforeLoad`

## 阻塞于

- i-32: apps/web 基建搭建（需要 TanStack Start 骨架 + Vite 配置就绪）

## 范围外

- 不创建 App Shell 布局（Sidebar/TabBar 属于 f-34）
- 不迁移 Overlay 系统（属于 f-34）
- 不迁移任何业务页面（Chat/KB 等）
- 不修改后端 API 或 DTO
