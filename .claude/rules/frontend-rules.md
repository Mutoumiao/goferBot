---
name: frontend-rules
description: 前端编码规范导航与核心约束
globs:
  - "packages/webui/**"
  - "tests/unit/webui/**"
---

# 前端编码规范导航

## 首次阅读
首次编辑前端代码前，阅读 `docs/guide/frontend/README.md`。

## 核心约束（已读过则以此为准）

- 框架：Vue 3 + TypeScript + Vite
- 状态管理：Pinia
- UI 组件：shadcn-vue + Tailwind CSS v4
- 颜色使用 Pencil tokens：`bg-surface-1`, `text-text-primary`
- Class 管理使用 `cn()` + `class-variance-authority`
- 图标使用 `lucide-vue-next`

## 涉及以下场景时，阅读对应文档

| 场景 | 文档 |
|------|------|
| Dialog/ContextMenu/Toast | `docs/guide/frontend/overlay-conventions.md` |
| Mock 数据 | `docs/guide/frontend/mock-conventions.md` |
| 编写测试 | `docs/guide/testing/README.md` |
