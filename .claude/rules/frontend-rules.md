---
name: frontend-rules
description: 前端编码规范导航与核心约束
globs:
  - "packages/web/**"
  - "packages/admin/**"
  - "tests/unit/web/**"
---

# 前端编码规范导航

## 项目结构

| 目录 | 技术栈 | 状态 |
|------|--------|------|
| `packages/web/` | TanStack Start + React + Zustand + shadcn/ui | **主前端（活跃开发）** |
| `packages/admin/` | React + Ant Design Pro | 未来建设 |
| `packages/webui/` | Vue 3 + Vite + Pinia + shadcn-vue | **已冻结，待删除（f-39）** |

> 所有新功能必须在 `packages/web/` 中开发。`packages/webui/` 已冻结，仅保留供参考，不接收任何修改。

## 首次阅读

- **React 项目**：阅读 `packages/web/README.md`（项目开发指引）和 `.claude/rules/web-package-rules.md`（稳定规则）

## 核心约束（React 项目）

- 框架：TanStack Start + React + TypeScript + Vite
- 状态管理：Zustand
- HTTP 客户端：alova（`useSSE` / `useRequest`），禁止原生 `fetch`
- UI 组件：shadcn/ui + Tailwind CSS v4
- Class 管理：`cn()` + `class-variance-authority`
- 图标：`lucide-react`
- 数据获取：alova Method → Zustand store → Component（单向流。详见 `.claude/rules/web-package-rules.md`）

## 参考文档索引

| 场景 | 文档 |
|------|------|
| **开发前必读** | `packages/web/README.md` |
| **强制规则** | `.claude/rules/web-package-rules.md` |
| TanStack Start 框架 | `docs/reference/tanstack-start-guide.md` |
| shadcn/ui 组件 | `docs/reference/shadcn-ui-patterns.md` |
| Zustand 状态管理 | `docs/reference/zustand-patterns.md` |
| Alova 请求库 | `docs/reference/alova-react-guide.md` |
| 迁移检查清单 | `docs/reference/migration-checklist.md` |

## 涉及以下场景时，阅读对应文档

| 场景 | 文档 |
|------|------|
| 编写测试 | `docs/guide/testing/README.md` |
| 框架迁移决策 | `docs/prd/v3-frontend-migration.md` |
