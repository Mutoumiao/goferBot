---
id: f-08
status: closed
track: frontend
priority: p1
summary: 建立前端 Overlay 核心机制（Dialog/ContextMenu 函数式调用基础设施）
blocked_by: []
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

建立前端 `overlays/` 层的核心基础设施，为后续 Dialog 和 ContextMenu 的函数式调用重构提供统一机制。

包含：
- `OverlayHost.vue` + `useOverlayHost.ts`（队列管理、z-index、兜底清理）
- `dialog.service.ts` + `context-menu.service.ts`（open/close/closeAll）
- `useDialog.ts`（`defineDialog`）+ `useContextMenu.ts`（`defineContextMenu`）
- `overlay.types.ts`（泛型约束、BaseProps）
- 基础单元测试

## 规格引用

- 功能规格: specs/feature-spec.md
- 行为规格: specs/behavior-spec.md

## 补充说明

- 这是所有后续 Dialog/ContextMenu 重构的阻塞基础
- 不迁移任何现有组件，只建立基础设施
- 参考 PRD: `docs/prd/overlay-refactor-prd.md`
