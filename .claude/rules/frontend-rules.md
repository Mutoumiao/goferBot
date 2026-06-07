---
name: frontend-rules
description: 前端编码规范导航与核心约束
globs:
  - "packages/webui/**"
  - "packages/web/**"
  - "packages/admin/**"
  - "tests/unit/webui/**"
  - "tests/unit/web/**"
---

# 前端编码规范导航

## 项目结构

本项目包含多个前端应用，规范按项目区分：

| 目录 | 技术栈 | 状态 |
|------|--------|------|
| `packages/webui/` | Vue 3 + Vite + Pinia + shadcn-vue | 维护中，逐步迁移 |
| `packages/web/` | TanStack Start + React + Zustand + shadcn/ui | 新开发（推荐） |
| `packages/admin/` | React + Ant Design Pro | 未来建设 |

## 首次阅读

- **Vue 项目**：阅读 `docs/guide/frontend/README.md`（Vue 版本）
- **React 项目**：阅读 `packages/web/README.md`（项目开发指引）和 `.claude/rules/web-package-rules.md`（稳定规则）

## 核心约束（按项目）

### React 项目（packages/web）

- 框架：TanStack Start + React + TypeScript + Vite
- 状态管理：Zustand
- HTTP 客户端：alova（`useSSE` / `useRequest`），禁止原生 `fetch`
- UI 组件：shadcn/ui + Tailwind CSS v4
- Class 管理：`cn()` + `class-variance-authority`
- 图标：`lucide-react`
- 数据获取：alova Method → Zustand store → Component（单向流。详见 `.claude/rules/web-package-rules.md`）

### Vue 项目（packages/webui）

- 框架：Vue 3 + TypeScript + Vite
- 状态管理：Pinia
- UI 组件：shadcn-vue + Tailwind CSS v4
- 颜色使用 Pencil tokens：`bg-surface-1`, `text-text-primary`
- Class 管理：`cn()` + `class-variance-authority`
- 图标：`lucide-vue-next`

## 参考文档索引

### React 项目参考

| 场景 | 文档 |
|------|------|
| **开发前必读** | `packages/web/README.md` |
| **强制规则** | `.claude/rules/web-package-rules.md` |
| TanStack Start 框架 | `docs/reference/tanstack-start-guide.md` |
| Vue → React 迁移 | `docs/reference/vue-to-react-patterns.md` |
| shadcn/ui 组件 | `docs/reference/shadcn-ui-patterns.md` |
| Zustand 状态管理 | `docs/reference/zustand-patterns.md` |
| Alova 请求库 | `docs/reference/alova-react-guide.md` |
| 迁移检查清单 | `docs/reference/migration-checklist.md` |

### Vue 项目参考

| 场景 | 文档 |
|------|------|
| Overlay 规范 | `docs/guide/frontend/overlay-conventions.md` |
| Mock 数据 | `docs/guide/frontend/mock-conventions.md` |
| 测试体系 | `docs/guide/testing/README.md` |

## 涉及以下场景时，阅读对应文档

| 场景 | 文档 |
|------|------|
| Dialog/ContextMenu/Toast（Vue） | `docs/guide/frontend/overlay-conventions.md` |
| Mock 数据（Vue） | `docs/guide/frontend/mock-conventions.md` |
| 编写测试 | `docs/guide/testing/README.md` |
| 框架迁移决策 | `docs/prd/v3-frontend-migration.md` |
