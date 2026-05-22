# 功能规格：前端 Overlay 核心机制

## 用户故事

作为前端开发者，我希望通过函数式 API 调用 Dialog 和 ContextMenu 组件，以便：
- 对话框和右键菜单能够独立复用，不在业务组件模板中内联声明
- 组件关闭后自动从 DOM 中卸载，不常驻内存
- 多个浮层同时存在时层级管理正确，后打开的在最上层

## 边界

### 范围内
- `packages/webui/src/overlays/` 目录及其子目录的完整基础设施
- `OverlayHost.vue` 渲染宿主（队列管理、动态渲染、z-index、兜底清理）
- `dialog.service.ts` 和 `context-menu.service.ts`（open/close/closeAll API）
- `useDialog.ts`（`defineDialog` 辅助）和 `useContextMenu.ts`（`defineContextMenu` 辅助）
- `overlay.types.ts` 类型定义（泛型约束、BaseProps）
- 基础单元测试

### 范围外
- 任何现有业务 Dialog/ContextMenu 的迁移（属于 f-09 和 f-10）
- shadcn-vue 原子组件的修改或替换
- Promise 风格 API 的支持
- 后端 API 的变更

## 涉及页面/组件

- `packages/webui/src/overlays/host/OverlayHost.vue`
- `packages/webui/src/overlays/host/useOverlayHost.ts`
- `packages/webui/src/overlays/services/dialog.service.ts`
- `packages/webui/src/overlays/services/context-menu.service.ts`
- `packages/webui/src/overlays/composables/useDialog.ts`
- `packages/webui/src/overlays/composables/useContextMenu.ts`
- `packages/webui/src/overlays/types/overlay.types.ts`
- `packages/webui/src/overlays/index.ts`
- `packages/webui/src/App.vue`（挂载 OverlayHost）
- `packages/webui/src/main.ts`（注册 OverlayHost）

## 相关功能

- **下游 f-09-dialog-migration** — 使用本机制迁移现有 Dialog 组件
- **下游 f-10-context-menu-and-conventions** — 使用本机制迁移现有 ContextMenu 并编写规范文档
- **上游 shadcn-vue** — 提供 Dialog/ContextMenu 原子组件作为视觉基础

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 采用 Overlay Host + 动态渲染队列机制 | 共享 App 上下文（Pinia/provide/inject），避免 `createApp` 创建独立实例导致全局状态丢失 | 是，可改为 `createApp` 动态挂载 |
| 回调风格 API（非 Promise） | PRD 明确要求，与现有代码风格一致 | 是，可后续补充 Promise 支持 |
| 关闭后完全卸载（不常驻 DOM） | PRD 明确要求，减少内存占用 | 否，一旦采用即为核心机制 |
| `crypto.randomUUID()` 生成 overlay id | 浏览器原生支持，无需额外依赖 | 是，可改为 nanoid 或自增 |
| Host 根节点固定 `z-index: 9999` | 确保 overlay 始终在最上层，不被其他业务组件遮挡 | 是，可改为动态计算 |
