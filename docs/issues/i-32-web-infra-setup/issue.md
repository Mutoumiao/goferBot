---
id: i-32
status: open
track: infra
priority: p0
summary: 建立 apps/web/ 项目骨架 — TanStack Start 初始化、Vite 配置（代理/别名/Tailwind v4）、pnpm workspace 注册，验证 dev/build 链路可用
blocked_by: []
checklist: checklist.json
plan: plan.md
specs: specs/
prd: docs/prd/v3-frontend-migration.md
prd_section: §5.1 阶段一：基建搭建
---

## 要构建的内容

在 Monorepo 中新建 `apps/web/` 项目，初始化 TanStack Start + React + Tailwind v4 + shadcn/ui 技术栈，配置 Vite 代理与路径别名，注册 pnpm workspace，验证 `pnpm dev:web` 和 `pnpm build` 能正常运行。

## 规格引用

- 功能规格: specs/feature-spec.md

## PRD 引用

- **来源 PRD**: docs/prd/v3-frontend-migration.md
- **对应章节**: §5.1 阶段一：基建搭建
- **核心目标**: 建立新项目骨架，验证构建链路；`apps/web` 可运行，显示默认首页；复用现有 Vite 代理规则和 Tailwind 主题
- **验收标准**: `pnpm dev:web` 正常启动并代理到后端；`pnpm build` 产物无错误

## 验收标准

- [ ] `apps/web/` 目录存在，包含 TanStack Start 标准文件结构（`app/routes/__root.tsx`、`app/router.tsx`、`app/client.tsx`、`app/ssr.tsx`）
- [ ] `vite.config.ts` 配置：`@/` → `./app` 路径别名、`/api` → `localhost:3000` 代理、Tailwind v4 plugin
- [ ] `pnpm-workspace.yaml` 包含 `apps/*`
- [ ] `apps/web/package.json` 依赖：Zustand、alova、lucide-react
- [ ] `pnpm dev:web` 启动无报错，访问默认首页返回 200
- [ ] `pnpm build`（或 `pnpm --filter @goferbot/web build`）产物无错误
- [ ] 参考资源：`docs/reference/tanstack-start-guide.md` 的初始化与 Vite 配置章节已验证可复现

## 阻塞于

无

## 范围外

- 不创建任何业务页面或组件
- 不配置鉴权/路由守卫
- 不迁移现有 Vue 代码
