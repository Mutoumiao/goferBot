---
name: frontend-rules
description: 前端项目导航 — 多包管理与文档索引
globs:
  - "packages/web/**"
  - "packages/admin/**"
  - "tests/unit/web/**"
---

# 前端项目导航

## 项目状态

| 目录 | 技术栈 | 状态 |
|------|--------|------|
| `packages/web/` | TanStack Start + React + Zustand + alova + shadcn/ui | **主前端（活跃开发）** |
| `packages/admin/` | React + Ant Design Pro | 未来建设 |
| `packages/webui/` | Vue 3 + Pinia + shadcn-vue | **已冻结，待删除（f-39）** |

> 所有新功能在 `packages/web/` 开发。`webui/` 不接收任何修改。

## 开发前必读（按顺序）

1. **`.claude/rules/web-package-rules.md`** — 强制约束（5 条，违反即不合规）
2. **`.claude/rules/architecture.md`** — Feature First 架构原则
3. **`packages/web/README.md`** — 目录结构、已有封装、代码示例

## 参考文档（按需查阅）

| 场景 | 文档 |
|------|------|
| TanStack Start 路由 | `docs/reference/tanstack-start-guide.md` |
| shadcn/ui 组件用法 | `docs/reference/shadcn-ui-patterns.md` |
| Zustand 状态管理 | `docs/reference/zustand-patterns.md` |
| alova 请求库 | `docs/reference/alova-react-guide.md` |
| 编写测试 | `docs/guide/testing/README.md` |
