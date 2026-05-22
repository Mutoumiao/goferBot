---
name: f-10-feature-spec
description: ContextMenu 迁移与前端 overlay 规范文档的功能规格
metadata:
  type: spec
  issue: f-10
  track: frontend
---

# 功能规格：ContextMenu 迁移与 Overlay 规范文档

## 用户故事

作为前端开发者，我希望：
- 通过函数式 API `openContextMenu()` 调用右键菜单，消除模板内联和 Teleport 自实现
- 所有 ContextMenu 统一在 `overlays/context-menus/` 目录，易于发现和维护
- 有书面规范指导未来新增 Dialog/ContextMenu 的目录、类型、可访问性约束

## 边界

### 范围内

**ContextMenu 迁移（2 处）：**
- `FileManager.vue` 内联 ContextMenu → `overlays/context-menus/FileContextMenu.vue`
- `FileExplorer.vue` 使用的 `ContextMenu.vue` → `overlays/context-menus/FileExplorerContextMenu.vue`，废弃旧 `ContextMenu.vue`

**Overlay 规范文档：**
- 创建 `docs/webui-guide/overlay-conventions.md`
- 覆盖目录约束、类型安全、可访问性三个维度

**受影响调用方（仅修改调用方式）：**
- `FileManager.vue` — 移除内联 ContextMenu，改为 `openContextMenu(FileContextMenu, props)`
- `FileExplorer.vue` — `ContextMenu.vue` 替换为 `openContextMenu(FileExplorerContextMenu, props)`
- `KnowledgeBasePage.vue` — 检查 ContextMenu 引用，同步更新

### 范围外
- Dialog 迁移（已完成，f-09）
- Promise 风格 API
- shadcn-vue/reka-ui 原子组件修改
- 非 ContextMenu 的 overlay 类型

## 涉及页面/组件

| 组件 | 操作 | 涉及 ContextMenu |
|------|------|------------------|
| FileManager.vue | 移除内联，改为函数式调用 | FileContextMenu.vue |
| FileExplorer.vue | 替换 ContextMenu.vue 引用 | FileExplorerContextMenu.vue |
| KnowledgeBasePage.vue | 检查并更新引用 | 如有则同步 |
| ContextMenu.vue | 废弃 | — |

## 相关功能

- f-08-overlay-core — 提供 `openContextMenu()` / `defineContextMenu()` / `OverlayHost`
- f-09-dialog-migration — 同批次重构，规范文档需覆盖 Dialog 和 ContextMenu

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 废弃旧 `ContextMenu.vue`（Teleport + 全局事件监听模式） | f-08 已提供 OverlayHost 统一渲染，旧模式冗余 | 否（已迁移后无引用） |
| FileManager / FileExplorer 分别独立 ContextMenu 组件 | 两个页面菜单项不同，复用会导致 props 爆炸 | 是（可合并为通用组件） |
| 规范文档放在 `docs/webui-guide/`（项目级）而非 `docs/guide/`（流程级） | 前端专项规范与开发流程规范分离，避免混淆 | 是 |
