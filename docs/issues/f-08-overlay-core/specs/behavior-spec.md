# 行为规格：前端 Overlay 核心机制

## 入口

- **代码入口**：开发者在业务组件中调用 `openDialog(DialogComponent, props)` 或 `openContextMenu(ContextMenuComponent, props)`
- **框架入口**：`App.vue` 模板中声明 `<OverlayHost />`，`main.ts` 中注册组件

## 初始状态

- 应用启动后，`OverlayHost` 挂载于 body 末尾，内部队列为空，DOM 中无 overlay 内容
- `openDialog` / `closeDialog` / `closeAllDialogs` 和 `openContextMenu` / `closeContextMenu` / `closeAllContextMenus` 处于可用状态

## 交互状态

| 状态 | 视觉 | 触发条件 | 系统响应 |
|------|------|----------|----------|
| 正常打开 | overlay 出现在视口中央/指定坐标，背景有遮罩（Dialog）或无边框（ContextMenu） | 调用 `openDialog()` / `openContextMenu()` | Host 向队列 push overlay 配置，动态渲染组件，z-index 按队列顺序递增 |
| 堆叠打开 | 多个 overlay 同时可见，后打开的在最上层 | 在已有 overlay 打开时再次调用 open | 新 overlay 的 z-index 比之前的高，焦点自动切换到最新的 overlay |
| 正常关闭 | overlay 从视口中消失，DOM 中移除对应节点 | 组件内部调用 `close()` 或用户点击遮罩/ESC | Host 从队列移除对应项，Vue 自动卸载组件树 |
| 强制清理 | 对应类型的所有 overlay 同时消失 | 调用 `closeAllDialogs()` / `closeAllContextMenus()` 或路由跳转 | Host 清空对应类型的子队列（Dialog 和 ContextMenu 互不影响），批量卸载 |
| 异常清理 | overlay 消失，控制台可能输出错误信息 | 组件内部抛出未捕获异常 | Vue `onErrorCaptured` 触发，通知 Host 移除对应 overlay |
| 页面刷新 | 所有 overlay 消失（与正常关闭相同） | 用户刷新页面或关闭标签页 | `beforeunload` 事件触发 Host 清空所有队列 |

## 正常流程

### Dialog 打开与关闭流程

| 步骤 | 操作者 | 操作 | 系统响应 | 视觉状态 |
|------|--------|------|----------|----------|
| 1 | 开发者 | 调用 `openDialog(ConfirmDialog, { title: '确认', onConfirm: () => {} })` | 生成唯一 id，向 Host 队列 push overlay 配置 | Host 渲染 ConfirmDialog，Dialog 出现在屏幕中央，背景遮罩显示 |
| 2 | 用户 | 点击"确认"按钮 | 组件内部调用 `props.onConfirm?.()`，然后调用 `close()` | 按钮可能有短暂 loading（由业务组件控制） |
| 3 | Host | 接收到 close 指令 | 从队列移除该 overlay，Vue 卸载组件 | Dialog 消失，遮罩消失，焦点恢复到 `document.body`（函数式调用无触发元素引用） |
| 4 | 系统 | 卸载完成 | 清理对应的 DOM 节点 | DOM 中无残留 |

### ContextMenu 打开与关闭流程

| 步骤 | 操作者 | 操作 | 系统响应 | 视觉状态 |
|------|--------|------|----------|----------|
| 1 | 开发者 | 调用 `openContextMenu(FileContextMenu, { x: 100, y: 200, onRename: () => {} })` | 生成唯一 id，向 Host 队列 push overlay 配置 | Host 渲染 FileContextMenu，菜单位于坐标 (100, 200) |
| 2 | Host | 渲染后测量实际尺寸并计算边界 | 组件挂载后通过 `getBoundingClientRect()` 获取实际宽高；若超出视口则调整位置 | 菜单完全在视口内，无截断 |
| 3 | 用户 | 点击菜单项"重命名" | 组件内部调用 `props.onRename?.()`，然后调用 `close()` | 菜单消失 |
| 4 | 用户 | 或点击菜单外部 / 按 ESC | Host 自动关闭该 ContextMenu | 菜单消失 |

### 同类型堆叠场景流程

| 步骤 | 操作者 | 操作 | 系统响应 | 视觉状态 |
|------|--------|------|----------|----------|
| 1 | 开发者 | 调用 `openDialog(DialogA)` | DialogA 渲染，z-index: 10000 | DialogA 可见 |
| 2 | 开发者 | 调用 `openDialog(DialogB)` | DialogB 渲染，z-index: 10001 | DialogB 覆盖在 DialogA 之上，焦点在 DialogB |
| 3 | 用户 | 关闭 DialogB | DialogB 卸载，焦点回到 DialogA | DialogA 重新成为最上层可交互元素 |
| 4 | 用户 | 关闭 DialogA | DialogA 卸载 | 无 overlay 残留 |

### 混合类型堆叠场景流程（Dialog + ContextMenu）

| 步骤 | 操作者 | 操作 | 系统响应 | 视觉状态 |
|------|--------|------|----------|----------|
| 1 | 开发者 | 调用 `openDialog(DialogA)` | DialogA 渲染，z-index: 10000 | DialogA 可见，背景遮罩显示 |
| 2 | 开发者 | 在 DialogA 内右键调用 `openContextMenu(MenuA)` | MenuA 渲染，z-index: 10001 | MenuA 覆盖在 DialogA 之上，无额外遮罩（ContextMenu 不添加遮罩） |
| 3 | 用户 | 点击 MenuA 外部 | MenuA 关闭，DialogA 保持打开 | 焦点回到 DialogA |
| 4 | 用户 | 关闭 DialogA | DialogA 卸载 | 无 overlay 残留 |

**规则**：Dialog 和 ContextMenu 共享同一个全局 z-index 序列，按打开顺序递增，不区分类型。

### 路由切换自动清理流程

| 步骤 | 操作者 | 操作 | 系统响应 | 视觉状态 |
|------|--------|------|----------|----------|
| 1 | 用户 | 在 Dialog 打开时点击浏览器前进/后退或导航链接 | Vue Router `beforeEach` 钩子触发 | 所有 overlay（Dialog + ContextMenu）自动关闭 |
| 2 | Host | 接收到路由切换信号 | 调用 `closeAllDialogs()` 和 `closeAllContextMenus()` | 所有 overlay 消失，DOM 无残留 |
| 3 | 系统 | 路由跳转完成 | 正常进入新页面 | 新页面无上一页 overlay 残留 |

## 错误场景

| 场景 | 触发 | 视觉 | 恢复 |
|------|------|------|------|
| 传入非组件类型 | `openDialog('not-a-component', props)` | TypeScript 编译期报错，运行时抛出类型错误 | 开发阶段修复类型，生产环境不应出现 |
| 回调未传入 | `openDialog(ConfirmDialog, { title: 'X' })`，用户点击确认 | 不报错，因内部使用 `props.onConfirm?.()`，Dialog 正常关闭 | 无需恢复，行为符合预期（静默关闭） |
| 组件内部异常 | Dialog 组件的 `onMounted` 中抛出错误 | 该 Dialog 不渲染或渲染中断，控制台输出错误 | Vue 错误处理器自动移除该 overlay，不影响其他 overlay |
| 重复关闭同一 id | 连续两次调用 `closeDialog('same-id')` | 第二次无效果，不报错 | 无需恢复，幂等行为 |
| 内存泄漏（极端情况） | 开发者忘记调用 close，且无用户交互 | 页面刷新前 overlay 一直存在 | `beforeunload` 事件兜底清理 |

## 测试映射

| 交互状态 | 测试文件 | 测试用例 |
|----------|----------|----------|
| 正常打开 | `tests/issues/f-08-overlay-core/dialog.service.spec.ts` | `AC-01: opens dialog and renders component in DOM` |
| 正常关闭 | `tests/issues/f-08-overlay-core/dialog.service.spec.ts` | `AC-02: closes dialog and removes component from DOM` |
| 同类型堆叠打开 | `tests/issues/f-08-overlay-core/overlay-host.spec.ts` | `AC-03: renders multiple dialogs with increasing z-index` |
| 混合类型堆叠 | `tests/issues/f-08-overlay-core/overlay-host.spec.ts` | `AC-04: dialog and context menu share global z-index sequence` |
| 强制清理 | `tests/issues/f-08-overlay-core/dialog.service.spec.ts` | `AC-05: closeAllDialogs removes only dialog overlays` |
| 异常清理 | `tests/issues/f-08-overlay-core/overlay-host.spec.ts` | `AC-06: removes overlay when child component throws error` |
| 页面刷新清理 | `tests/issues/f-08-overlay-core/overlay-host.spec.ts` | `AC-07: clears all overlays on beforeunload` |
| 路由切换清理 | `tests/issues/f-08-overlay-core/overlay-host.spec.ts` | `AC-08: clears all overlays on route change` |
| ContextMenu 边界检测 | `tests/issues/f-08-overlay-core/context-menu.service.spec.ts` | `AC-09: adjusts position when menu exceeds viewport` |
| ContextMenu 外部点击关闭 | `tests/issues/f-08-overlay-core/context-menu.service.spec.ts` | `AC-10: closes context menu on outside click` |
| defineDialog 封装 | `tests/issues/f-08-overlay-core/useDialog.spec.ts` | `AC-11: defineDialog returns isOpen state and close function` |
| defineContextMenu 封装 | `tests/issues/f-08-overlay-core/useContextMenu.spec.ts` | `AC-12: defineContextMenu returns isOpen state and close function` |
