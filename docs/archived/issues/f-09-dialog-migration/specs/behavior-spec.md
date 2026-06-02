# 行为规格：Dialog 迁移至 overlays/

## 入口

- **代码入口**：业务组件中调用 `openDialog(DialogComponent, props)` 打开 Dialog；Dialog 内部调用 `close()`（来自 `defineDialog()`）关闭
- **组件入口**：Dialog 组件通过 `defineDialog()` 获取 `{ isOpen, close }`，通过 props 接收业务参数和回调
- **框架入口**：`OverlayHost` 已在 `App.vue` 中挂载，无需修改

## 初始状态

- 页面加载后，所有 Dialog 均未打开，DOM 中无 Dialog 残留
- `openDialog` / `closeDialog` / `closeAllDialogs` 可用
- 原组件内联 Dialog 的 `v-if` / `v-model` 模式已移除

## 交互状态

| 状态 | 视觉 | 触发条件 | 系统响应 |
|------|------|----------|----------|
| 打开 | Dialog 出现在视口中央，背景有半透明遮罩，背景页面禁止滚动 | 调用 `openDialog(Component, props)` | OverlayHost 将 Dialog 组件加入渲染队列，z-index 自动分配，reka-ui 自动 focus trap 到 Dialog 内第一个可交互元素 |
| 提交中 | 确认按钮显示 loading 状态，取消按钮禁用 | 用户点击确认按钮，`onConfirm` 返回 Promise | Dialog 保持打开，按钮进入 loading 态 |
| 提交成功 | Dialog 关闭，触发后续业务刷新 | `onConfirm` Promise resolve | `close()` 调用 → OverlayHost 移除 → DOM 卸载，reka-ui 自动恢复 body 滚动 |
| 提交失败 | Dialog 保持打开，显示内联错误信息 | `onConfirm` Promise reject 或组件内部捕获错误 | 错误信息显示在 Dialog 内，用户可重试 |
| 取消关闭 | Dialog 关闭，无副作用 | 用户点击取消 / 点击遮罩 / 按 ESC | `close()` 调用 → 无回调触发 |
| 异常关闭 | Dialog 关闭，控制台可能输出错误 | 组件内部未捕获异常 | `onErrorCaptured` 触发 overlay 移除（f-08 已实现） |

## 可访问性

| 行为 | 实现方式 | 可禁用？ |
|------|----------|----------|
| 焦点管理 | reka-ui Dialog 自动 focus trap，打开时聚焦到 Dialog 内第一个可聚焦元素 | — |
| ESC 关闭 | reka-ui Dialog 默认行为，`DialogBaseProps.disableEsc` 可禁用 | ✅ |
| 遮罩点击关闭 | reka-ui Dialog 默认行为，`DialogBaseProps.disableOverlayClick` 可禁用 | ✅ |
| 背景滚动锁定 | reka-ui Dialog 打开时自动设置 `body { overflow: hidden }`，关闭时恢复 | — |

## 正常流程

### 通用 Dialog 打开与关闭流程

| 步骤 | 操作者 | 操作 | 系统响应 | 视觉状态 |
|------|--------|------|----------|----------|
| 1 | 开发者 | 调用 `openDialog(SomeDialog, { title: '...', onConfirm: () => {} })` | overlay 系统生成 id，push 到队列 | Dialog 出现在屏幕中央，背景遮罩显示，背景锁定 |
| 2 | 用户 | 填写表单/确认信息 | — | 表单字段更新，确认按钮可点击 |
| 3 | 用户 | 点击确认按钮 | 调用 `props.onConfirm?.()`，进入 loading 态 | 确认按钮显示 spinner |
| 4 | 系统 | onConfirm 完成 | 组件调用 `close()` → overlay 从队列移除 | Dialog 消失，DOM 卸载，背景恢复滚动 |

### 各 Dialog 差异流程

| Dialog | 特有逻辑 | onConfirm 行为 |
|--------|----------|----------------|
| CreateFolderDialog | 输入文件夹名，校验空值 | 调用 store 创建文件夹 → 刷新列表 |
| RenameDialog | 输入新名称，校验空值/同名 | 调用 store 重命名 → 刷新列表 |
| DeleteConfirmDialog | 确认描述文本，kind 对应不同样式 | 调用 store 删除 → 刷新列表 |
| ConfirmDialog | 标题+消息+确认/取消，替代 `confirmDialog()` | 调用传入的 onConfirm 回调 |
| EditKbDialog | 名称+图标编辑 | 调用 store 更新 KB 元数据 |
| MoveCopyDialog | 选择目标 KB/文件夹，支持浏览 | 调用 store 移动/复制文件 |

### 受影响页面（仅验证，不重构）

| 页面 | 内联 Dialog | 处理方式 |
|------|-------------|----------|
| KnowledgeBasePage | 创建 KB、重命名 KB、删除 KB（3个） | 无变更，保留现有实现 |
| FileUpload | 上传 Dialog（1个） | 无变更，保留现有实现 |
| HistoryPage | 删除会话确认（1个） | 无变更，保留现有实现 |

## 错误场景

| 场景 | 触发 | 视觉 | 恢复 |
|------|------|------|------|
| 文件夹名称为空 | 用户提交空名称 | Dialog 内显示 "名称不能为空" 错误提示 | 用户修改后重试 |
| 网络错误 | fetch 失败 | Dialog 内显示 "网络错误，请重试" | 用户点击重试 |
| 组件未传入回调 | `openDialog(Dialog, {})` | 确认按钮无反应，Dialog 正常关闭（回调可选链） | 无需恢复 |
| 重复打开同一 Dialog | 快速双击打开按钮 | 两个独立 Dialog 实例，z-index 递增 | 逐一关闭 |
| ConfirmDialog 原调用方传入 Promise 回调 | `onConfirm: async () => {...}` | `defineDialog` 内部 `await props.onConfirm?.()` 后 `close()` | 与原有行为一致 |

## 测试映射

| 交互状态 | 测试文件 | 测试用例 |
|----------|----------|----------|
| 打开 | `tests/issues/f-09-dialog-migration/dialogs.spec.ts` | AC-01: openDialog creates overlay in queue |
| 渲染 | `tests/issues/f-09-dialog-migration/dialogs.spec.ts` | AC-02: Dialog component renders with correct props |
| 关闭 | `tests/issues/f-09-dialog-migration/dialogs.spec.ts` | AC-03: close() removes overlay from queue |
| 提交 | `tests/issues/f-09-dialog-migration/dialogs.spec.ts` | AC-04: onConfirm callback invoked on confirm click |
| 取消 | `tests/issues/f-09-dialog-migration/dialogs.spec.ts` | AC-05: cancel calls close without onConfirm |
| 异常 | `tests/issues/f-09-dialog-migration/dialogs.spec.ts` | AC-06: dialog error does not crash host |
| 复用 | `tests/issues/f-09-dialog-migration/dialogs.spec.ts` | AC-07: RenameDialog renders with initial value |
| 样式 | `tests/issues/f-09-dialog-migration/dialogs.spec.ts` | AC-08: DeleteConfirmDialog respects kind prop |
| 回归 | `tests/issues/f-09-dialog-migration/dialogs.spec.ts` | AC-09: FileManager dialogs work via openDialog |
| 回归 | `tests/issues/f-09-dialog-migration/dialogs.spec.ts` | AC-10: non-migrated pages function normally |
