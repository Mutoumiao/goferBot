# 功能规格：packages/web 基建搭建

> 状态：draft | 关联 issue：i-32 | PRD：docs/prd/v3-frontend-migration.md §5.1

---

## 1. 目标

在 GoferBot Monorepo 中建立 `packages/web/` 项目骨架，使用 TanStack Start + React + Tailwind v4 + shadcn/ui 技术栈，复用现有 Vite 代理规则和 Tailwind 主题变量，验证 `pnpm dev:web` 和 `pnpm build` 链路可用。

---

## 2. 功能描述

### 2.1 项目初始化

使用 `npm create @tanstack/start@latest --tailwind --add-ons shadcn` 在 `packages/web/` 创建项目骨架，生成标准 TanStack Start 文件结构。

### 2.2 Vite 配置

在 `packages/web/vite.config.ts` 中配置：

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 路径别名 `@/` | `./app` | 保持与现有 Vue 项目一致的导入习惯 |
| 路径别名 `~/` | `./app` | 兼容 TanStack Start 惯例 |
| 代理 `/api` | `http://localhost:3000` | 复用现有 Vite proxy，指向 NestJS 后端 |
| Tailwind v4 | `@tailwindcss/vite` plugin | 与现有 `packages/webui` 版本一致（^4.1.18） |
| 端口 | `1420` | 避免与 Vue dev server 冲突 |

### 2.3 pnpm workspace 注册

项目统一放在 `packages/` 目录下，`pnpm-workspace.yaml` 已配置 `packages/*`，无需额外修改。

### 2.4 依赖安装

`packages/web/package.json` 需包含：

| 依赖 | 用途 | 版本 |
|------|------|------|
| `@tanstack/react-start` | 框架 | latest |
| `@tanstack/react-router` | 路由 | latest |
| `react` / `react-dom` | UI 库 | ^19 |
| `tailwindcss` | 样式 | ^4.1.18 |
| `zustand` | 状态管理 | latest |
| `alova` | 请求库 | latest |
| `lucide-react` | 图标 | latest |
| `class-variance-authority` | class 管理 | latest |
| `clsx` / `tailwind-merge` | `cn()` 工具函数 | latest |

### 2.5 全局样式

从 `packages/webui/src/styles/` 复制 Tailwind 主题变量到 `packages/web/app/globals.css`，保留 Pencil tokens（`bg-surface-1`、`text-text-primary` 等）的 CSS 变量定义。

---

## 3. 目录结构

```
packages/web/
├── app/
│   ├── routes/
│   │   ├── __root.tsx           # 根路由（全局 HeadContent + Outlet + Scripts）
│   │   └── index.tsx            # 默认首页（占位，"GoferBot is running"）
│   ├── router.tsx               # createRouter 配置
│   ├── client.tsx               # 客户端入口（hydrateRoot）
│   ├── ssr.tsx                  # SSR 入口（可选，SPA 模式下可留空壳）
│   └── globals.css              # Tailwind + Pencil tokens
├── vite.config.ts               # Vite 配置
├── package.json
├── tsconfig.json
└── tailwind.config.ts           # 若无，使用 @tailwindcss/vite 的内联配置
```

| 文件 | 必需 | 说明 |
|------|------|------|
| `__root.tsx` | ✅ | 全局 HTML 骨架，包含 `<html>` + `<head>` + `<body>` |
| `index.tsx` | ✅ | 默认首页，验证构建链路 |
| `router.tsx` | ✅ | TanStack Router 配置 |
| `client.tsx` | ✅ | 客户端入口，hydrateRoot |
| `ssr.tsx` | 否 | SPA 模式下可为空壳 |
| `api.ts` | 否 | 阶段二才需要 |
| `start.ts` | 否 | 全局中间件，阶段二才需要 |

---

## 4. 技术约束

| 约束 | 来源 |
|------|------|
| Tailwind v4（非 v3），使用 `@tailwindcss/vite` plugin | PRD §3.1 |
| Class 管理使用 `cn()` + `class-variance-authority` | `.claude/rules/frontend-rules.md` |
| 图标使用 `lucide-react` | `.claude/rules/frontend-rules.md` |
| SPA 模式优先，不强制 SSR | PRD §7（TanStack Start 风险应对） |
| 不在此阶段配置 SPA 模式（`ssr: false`） — 先使用默认 SSR 配置确保构建链路正常，SPA 精简留到 f-33 鉴权阶段按需调整 | 风险控制 |

---

## 5. 验收标准映射

| AC | 验收项 | 验证方式 |
|----|--------|----------|
| AC-01 | `packages/web/` 目录存在，包含 TanStack Start 标准文件结构 | `ls packages/web/src/routes/__root.tsx` |
| AC-02 | `vite.config.ts` 配置正确（别名、代理、Tailwind v4、SPA） | 检查 `resolve.alias`、`server.proxy`、`plugins` |
| AC-03 | `pnpm-workspace.yaml` 包含 `packages/*` | `grep "packages" pnpm-workspace.yaml` |
| AC-04 | 依赖安装完整 | `pnpm --filter @goferbot/web ls`（或检查 `node_modules`） |
| AC-05 | `pnpm dev:web` 启动无报错，首页可访问 | `curl http://localhost:1420` 返回 200 |
| AC-06 | `pnpm build` 产物无错误 | `pnpm --filter @goferbot/web build` 退出码 0 |

---

## 6. 参考资源

- [TanStack Start 参考手册](../../../reference/tanstack-start-guide.md) — 项目初始化 + Vite 配置章节
- [前端编码规范](../../../../.claude/rules/frontend-rules.md) — React 项目核心约束
- [PRD v3 前端迁移](../../prd/v3-frontend-migration.md) — §2.1 目录结构、§5.1 阶段一
