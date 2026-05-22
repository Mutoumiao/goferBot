---
id: f-09
status: closed
track: frontend
priority: p1
summary: 迁移现有 Dialog 组件至 overlays/ 并改为函数式调用
blocked_by:
  - f-08-overlay-core
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

将所有现有内联和分散的 Dialog 组件迁移到 `overlays/dialogs/` 目录，统一使用函数式调用 API。

包含：
- 迁移 `FileManager.vue` 内联 Dialog（新建/重命名/删除）
- 迁移现有独立 Dialog 组件到 `overlays/dialogs/`（`ConfirmDialog.vue`、`EditKbDialog.vue`、`MoveCopyDialog.vue`），若组件逻辑可直接复用则保留并接入函数式 API，若与 shadcn-vue 原子组件重复则替换
- 所有调用点改为函数式 API（通过 props + 回调传递状态）
- 迁移后功能测试通过

## 规格引用

- 功能规格: specs/feature-spec.md
- 行为规格: specs/behavior-spec.md

## 补充说明

- 依赖 f-08-overlay-core 完成后启动
- 迁移过程中保持原有 UI 和行为不变，只改变调用方式
- 参考 PRD: `docs/prd/overlay-refactor-prd.md`
