# 功能规格：Dialog 迁移至 overlays/

## 用户故事

作为前端开发者，我希望通过函数式 API 调用 Dialog 组件，以便：
- 消除模板内联 Dialog 的冗余状态管理（每个 Dialog 需 5+ 个 ref）
- Dialog 关闭后自动从 DOM 卸载，不常驻内存
- 所有 Dialog 统一在 `overlays/dialogs/` 目录，易于发现和维护

## 边界

### 范围内

**FileManager.vue 内联 Dialog（3 个）：**
- 新建文件夹 Dialog → `overlays/dialogs/CreateFolderDialog.vue`
- 重命名 Dialog → 复用通用 `RenameDialog.vue`
- 删除确认 Dialog → 复用通用 `DeleteConfirmDialog.vue`

**独立 Dialog 组件迁移（3 个）：**
- `ConfirmDialog.vue` → `overlays/dialogs/ConfirmDialog.vue`（替代手动 render/Teleport 模式为函数式 API，废弃 `utils/confirm.ts`）
- `EditKbDialog.vue` → `overlays/dialogs/EditKbDialog.vue`（孤儿组件，迁移同时接入 KnowledgeBasePage 编辑入口）
- `MoveCopyDialog.vue` → `overlays/dialogs/MoveCopyDialog.vue`（孤儿组件，迁移同时接入 FileExplorer 移动/复制入口）

**受影响调用方（仅修改调用方式）：**
- `FileManager.vue` — 移除内联 Dialog，改为 `openDialog()` 调用
- `FileExplorer.vue` — `confirmDialog()` 替换为 `openDialog(ConfirmDialog, ...)`；移动/复制接入 `openDialog(MoveCopyDialog, ...)`
- `ConfirmDialog.vue` / `EditKbDialog.vue` / `MoveCopyDialog.vue` — 迁移到 overlays/dialogs/
- `utils/confirm.ts` — 废弃

### 范围外

- ContextMenu 迁移（属于 f-10）
- Promise 风格 API 支持
- shadcn-vue/reka-ui 原子组件修改
- **KnowledgeBasePage / FileUpload / HistoryPage 内联 Dialog 的迁移**（这些页面只需验证功能正常不被破坏，属于 AC-10）
- 新建不存在于当前代码库的 Dialog 组件

## 涉及页面/组件

| 组件 | 操作 | 涉及 Dialog |
|------|------|-------------|
| `FileManager.vue` | 重构 | 新建文件夹、重命名、删除确认 → 复用通用组件 |
| `FileExplorer.vue` | 修改调用点 | `confirmDialog()` → `openDialog()`；接入 MoveCopyDialog |
| `ConfirmDialog.vue` | 迁移 | 移入 overlays/dialogs/，改为函数式 |
| `EditKbDialog.vue` | 迁移+接入 | 移入 overlays/dialogs/，接入 KB 列表编辑入口 |
| `MoveCopyDialog.vue` | 迁移+接入 | 移入 overlays/dialogs/，接入 FileExplorer 移动/复制入口 |
| `utils/confirm.ts` | 废弃 | 替换为 `openDialog(ConfirmDialog, props)` |
| KnowledgeBasePage / FileUpload / HistoryPage | **无变更** | 仅验证功能正常（AC-10） |

## 相关功能

- **上游 f-08-overlay-core** — 提供 `openDialog`/`closeDialog`/`defineDialog` 基础设施
- **下游 f-10-context-menu-and-conventions** — ContextMenu 迁移 + overlay 规范文档
- **shadcn-vue** — 提供 Dialog/DialogContent 等原子组件作为视觉基础

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 每个 Dialog 类型独立组件文件 | 职责单一，方便复用和测试 | 是 |
| DeleteConfirmDialog 通用复用 | FileManager 两处删除确认逻辑相同（新建/重命名/删除的确认弹窗），一份组件复用 | 否 |
| RenameDialog 通用化 | 视需要可扩展为多场景复用 | 是 |
| ConfirmDialog 保留但改为函数式 | `utils/confirm.ts` 的 Promise 风格改为回调风格，对齐 f-08 API | 是 |
| EditKbDialog/MoveCopyDialog 迁移同时接入调用点 | 当前孤儿组件，一次完成迁移+接入 | 否 |
| 迁移保持原有 UI 和交互不变 | 只改调用方式，不改视觉表现 | 否 |
| reka-ui 底层自带 focus trap + scroll lock | 不额外实现，继承底层组件行为 | 否 |
