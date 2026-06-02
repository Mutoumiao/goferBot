# API 规格：Dialog 组件迁移

> 本 issue 为纯前端迁移，无 HTTP API 变更。以下为 overlay 函数式 API 的调用契约。

## 核心 API（f-08 提供，本次使用）

### openDialog

```typescript
import { openDialog } from '@/overlays'

function openDialog<TProps extends DialogBaseProps>(
  component: Component,
  props: TProps
): string  // 返回 overlay id，用于手动关闭
```

### closeDialog / closeAllDialogs

```typescript
import { closeDialog, closeAllDialogs } from '@/overlays'

function closeDialog(id: string): void
function closeAllDialogs(): void
```

### defineDialog

```typescript
import { defineDialog } from '@/overlays/composables/useDialog'

function defineDialog(): {
  isOpen: Ref<boolean>
  close: () => void
}
```

## 新建 Dialog 组件 Props 契约

所有 Props interface 继承 `DialogBaseProps`（`onConfirm?`, `onCancel?`, `disableEsc?`, `disableOverlayClick?`）。

### CreateFolderDialog

```typescript
interface CreateFolderDialogProps extends DialogBaseProps {
  kbId: string
  parentFolderId?: string | null
  onConfirm: (name: string) => void | Promise<void>
}
```

### RenameDialog

```typescript
interface RenameDialogProps extends DialogBaseProps {
  title: string
  initialValue: string
  onConfirm: (newName: string) => void | Promise<void>
}
```

### DeleteConfirmDialog

```typescript
interface DeleteConfirmDialogProps extends DialogBaseProps {
  title: string
  message: string
  confirmText?: string
  kind?: 'info' | 'warning' | 'danger'
  onConfirm: () => void | Promise<void>
}
```

### ConfirmDialog（迁移后）

```typescript
interface ConfirmDialogProps extends DialogBaseProps {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  kind?: 'info' | 'warning' | 'danger'
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void
}
```

### EditKbDialog（迁移后）

```typescript
interface EditKbDialogProps extends DialogBaseProps {
  kbId: string
  initialName: string
  initialIcon: string
  onConfirm: (name: string, icon: string) => void | Promise<void>
}
```

### MoveCopyDialog（迁移后）

```typescript
interface MoveCopyDialogProps extends DialogBaseProps {
  mode: 'move' | 'copy'
  sourceKbId: string
  sourcePath: string
  onConfirm: (targetKbId: string, targetPath: string) => void | Promise<void>
}
```

## 调用示例

### 迁移前（内联模式，FileManager.vue）

```vue
<!-- 5 个 ref + 30 行模板 -->
<script setup>
const showCreateFolderDialog = ref(false)
const createFolderName = ref('')
const createFolderError = ref('')
const isCreatingFolder = ref(false)
</script>
<template>
  <Dialog :open="showCreateFolderDialog" @update:open="(v) => !v && (showCreateFolderDialog = false)">
    <DialogContent>
      <DialogHeader><DialogTitle>新建文件夹</DialogTitle></DialogHeader>
      <Input v-model="createFolderName" />
      <DialogFooter>
        <Button variant="secondary" @click="showCreateFolderDialog = false">取消</Button>
        <Button @click="handleCreate">确认</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
```

### 迁移后（函数式 API）

```typescript
// 一行调用，组件内部通过 defineDialog() 管理生命周期
openDialog(CreateFolderDialog, {
  kbId: props.kbId,
  parentFolderId: currentFolderId.value,
  onConfirm: async (name) => {
    await store.createFolder(name)
    await store.loadFiles()
  },
})
```

### utils/confirm.ts 迁移前

```typescript
// packages/webui/src/utils/confirm.ts — 手动 render/Teleport 模式
if (await confirmDialog(`确定删除文件 "${name}" 吗？`, { title: '提示', kind: 'danger' })) {
  await store.deleteFile(id)
}
```

### utils/confirm.ts 迁移后

```typescript
// 使用 openDialog 替代，回调风格（对齐 f-08 API）
openDialog(ConfirmDialog, {
  title: '提示',
  message: `确定删除文件 "${name}" 吗？`,
  kind: 'danger',
  onConfirm: async () => {
    await store.deleteFile(id)
  },
})
```

## 废弃项

| 废弃项 | 位置 | 替代方案 |
|--------|------|----------|
| `utils/confirm.ts` — `confirmDialog()` | `packages/webui/src/utils/confirm.ts` | `openDialog(ConfirmDialog, props)` |
| `ConfirmDialog.vue` 手动 render 模式 | `packages/webui/src/components/ConfirmDialog.vue` | 移入 overlays/dialogs/，使用 defineDialog |
| `EditKbDialog.vue` visible prop 模式 | `packages/webui/src/components/EditKbDialog.vue` | 移入 overlays/dialogs/，使用 defineDialog |
| `MoveCopyDialog.vue` visible prop 模式 | `packages/webui/src/components/MoveCopyDialog.vue` | 移入 overlays/dialogs/，使用 defineDialog |
| FileManager.vue 内联 Dialog 模板 | `FileManager.vue` 模板中 3 个 `<Dialog>` 块 | `openDialog()` 调用 |
| FileManager.vue Dialog 相关 ref（~12 个） | `FileManager.vue` script | 移除 |

## 无变更项

| 页面 | 说明 |
|------|------|
| KnowledgeBasePage.vue | 内联 Dialog 保留，仅验证功能正常 |
| FileUpload.vue | 内联 Dialog 保留，仅验证功能正常 |
| HistoryPage.vue | 内联 Dialog 保留，仅验证功能正常 |

## 测试映射

| 测试文件 | 测试用例 |
|----------|----------|
| `tests/issues/f-09-dialog-migration/dialogs.spec.ts` | CreateFolderDialog 渲染与提交 |
| `tests/issues/f-09-dialog-migration/dialogs.spec.ts` | RenameDialog 渲染、初始值、校验 |
| `tests/issues/f-09-dialog-migration/dialogs.spec.ts` | DeleteConfirmDialog 渲染、kind 样式 |
| `tests/issues/f-09-dialog-migration/dialogs.spec.ts` | ConfirmDialog 替代 confirmDialog |
| `tests/issues/f-09-dialog-migration/dialogs.spec.ts` | EditKbDialog 迁移后渲染与保存 |
| `tests/issues/f-09-dialog-migration/dialogs.spec.ts` | MoveCopyDialog 迁移后渲染与移动/复制 |
| `tests/issues/f-09-dialog-migration/dialogs.spec.ts` | 非迁移页面回归测试（AC-10） |
