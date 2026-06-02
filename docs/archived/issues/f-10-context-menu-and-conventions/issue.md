---
id: f-10
status: closed
track: frontend
priority: p1
summary: 迁移 ContextMenu 并建立前端 overlay 规范文档
blocked_by:
  - f-08-overlay-core
  - f-09-dialog-migration
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

将现有 ContextMenu 迁移到 `overlays/context-menus/`，并建立前端专项规范文档。

包含：
- 迁移 `FileManager.vue` 内联 ContextMenu 到 `overlays/context-menus/`
- 迁移现有 `ContextMenu.vue` 到 `overlays/context-menus/`，接入函数式 API，移除旧的 Teleport 自实现逻辑
- 创建 `docs/webui-guide/` 目录
- 编写 `docs/webui-guide/overlay-conventions.md`
- 更新 `CLAUDE.md` 项目结构说明
- 更新 `docs/guide/README.md` 文档体系架构图
- 迁移后功能测试通过

## 规格引用

- 功能规格: specs/feature-spec.md
- 行为规格: specs/behavior-spec.md

## 补充说明

- 依赖 f-08-overlay-core 和 f-09-dialog-migration 完成后启动
- ContextMenu 需实现视口边界检测
- 规范文档需覆盖目录约束、类型安全、可访问性三个维度
- 参考 PRD: `docs/prd/overlay-refactor-prd.md`
