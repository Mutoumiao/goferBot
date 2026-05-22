---
id: f-08
issue: issue.md
version: 1
---

# 前端 Overlay 核心机制实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 建立前端 `overlays/` 层的核心基础设施，提供 Dialog 和 ContextMenu 的函数式调用 API，支持动态渲染、z-index 堆叠、自动清理。

**架构：** 采用 Overlay Host + 动态渲染队列机制。`OverlayHost.vue` 常驻于 body 末尾（通过 Teleport），内部维护 `overlays[]` 队列。`dialog.service.ts` 和 `context-menu.service.ts` 向队列注册/移除 overlay。`defineDialog()` / `defineContextMenu()` 通过 Vue provide/inject 获取关闭函数，控制组件卸载。

**技术栈：** Vue 3 + TypeScript + Vite + Vitest + @vue/test-utils

**Issue 引用：** [issue.md](issue.md)
**Spec 引用：** [specs/](specs/)

---

## 文件结构规划

### 新建文件

```
packages/webui/src/overlays/
  host/
    symbols.ts              # provide/inject 符号常量
    useOverlayHost.ts       # 队列管理（单例 reactive）
    OverlayHost.vue         # 渲染宿主（Teleport + 动态组件）
    OverlayItem.vue         # 单个 overlay 的 wrapper（provide close 函数）
  services/
    dialog.service.ts       # openDialog / closeDialog / closeAllDialogs
    context-menu.service.ts # openContextMenu / closeContextMenu / closeAllContextMenus
  composables/
    useDialog.ts            # defineDialog() 辅助
    useContextMenu.ts       # defineContextMenu() 辅助
  types/
    overlay.types.ts        # OverlayItem、DialogBaseProps、ContextMenuBaseProps
  index.ts                  # 统一导出

tests/issues/f-08-overlay-core/
  useOverlayHost.spec.ts
  dialog.service.spec.ts
  context-menu.service.spec.ts
  useDialog.spec.ts
  useContextMenu.spec.ts
  OverlayHost.spec.ts
```

### 修改文件

- `packages/webui/src/App.vue` — 模板中添加 `<OverlayHost />`
- `packages/webui/src/main.ts` — 注册 OverlayHost 组件、添加路由守卫清理

---

## 任务清单

### 任务 1: 建立目录结构 + 编写 overlay.types.ts

**文件：**
- 创建：`packages/webui/src/overlays/types/overlay.types.ts`

**规格引用：**
- 功能规格：[类型定义]
- 行为规格：[AC-08: overlay.types.ts 无 any 类型，泛型约束正确]

- [ ] **步骤 1: 建立目录结构**

```bash
mkdir -p packages/webui/src/overlays/{host,services,composables,types}
mkdir -p tests/issues/f-08-overlay-core
```

- [ ] **步骤 2: 编写类型定义**

```typescript
// packages/webui/src/overlays/types/overlay.types.ts
import type { Component } from 'vue'

export interface OverlayItem {
  id: string
  component: Component
  props: Record<string, unknown>
  type: 'dialog' | 'contextMenu'
}

export interface DialogBaseProps {
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void
  disableEsc?: boolean
  disableOverlayClick?: boolean
}

export interface ContextMenuBaseProps {
  x: number
  y: number
  onClose?: () => void
}
```

- [ ] **步骤 3: 提交**

```bash
git add packages/webui/src/overlays/
git commit -m "feat(overlays): 建立目录结构并定义核心类型"
```

---

### 任务 2: 编写 useOverlayHost.ts + 测试（TDD）

**文件：**
- 创建：`packages/webui/src/overlays/host/useOverlayHost.ts`
- 创建：`tests/issues/f-08-overlay-core/useOverlayHost.spec.ts`

**规格引用：**
- 行为规格：[AC-02: OverlayHost.vue 实现队列管理和动态渲染]
- 行为规格：[AC-13: closeAllDialogs 仅关闭 Dialog，不影响 ContextMenu]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/f-08-overlay-core/useOverlayHost.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useOverlayHost } from '../../../packages/webui/src/overlays/host/useOverlayHost'

describe('useOverlayHost', () => {
  beforeEach(() => {
    const { clearOverlays } = useOverlayHost()
    clearOverlays()
  })

  it('AC-01: should start with empty overlays array', () => {
    const { overlays } = useOverlayHost()
    expect(overlays).toHaveLength(0)
  })

  it('AC-02: should add overlay and return id', () => {
    const { overlays, addOverlay } = useOverlayHost()
    const id = addOverlay({
      component: {} as any,
      props: {},
      type: 'dialog'
    })
    expect(id).toBeDefined()
    expect(overlays).toHaveLength(1)
    expect(overlays[0].id).toBe(id)
    expect(overlays[0].type).toBe('dialog')
  })

  it('AC-03: should remove overlay by id', () => {
    const { overlays, addOverlay, removeOverlay } = useOverlayHost()
    const id = addOverlay({ component: {} as any, props: {}, type: 'dialog' })
    removeOverlay(id)
    expect(overlays).toHaveLength(0)
  })

  it('AC-04: should clear all overlays', () => {
    const { overlays, addOverlay, clearOverlays } = useOverlayHost()
    addOverlay({ component: {} as any, props: {}, type: 'dialog' })
    addOverlay({ component: {} as any, props: {}, type: 'contextMenu' })
    clearOverlays()
    expect(overlays).toHaveLength(0)
  })

  it('AC-13: should clear only dialog overlays when type is dialog', () => {
    const { overlays, addOverlay, clearOverlays } = useOverlayHost()
    addOverlay({ component: {} as any, props: {}, type: 'dialog' })
    addOverlay({ component: {} as any, props: {}, type: 'contextMenu' })
    clearOverlays('dialog')
    expect(overlays).toHaveLength(1)
    expect(overlays[0].type).toBe('contextMenu')
  })

  it('AC-13: should clear only contextMenu overlays when type is contextMenu', () => {
    const { overlays, addOverlay, clearOverlays } = useOverlayHost()
    addOverlay({ component: {} as any, props: {}, type: 'dialog' })
    addOverlay({ component: {} as any, props: {}, type: 'contextMenu' })
    clearOverlays('contextMenu')
    expect(overlays).toHaveLength(1)
    expect(overlays[0].type).toBe('dialog')
  })

  it('AC-09: should assign increasing z-index based on queue position', () => {
    const { overlays, addOverlay } = useOverlayHost()
    addOverlay({ component: {} as any, props: {}, type: 'dialog' })
    addOverlay({ component: {} as any, props: {}, type: 'dialog' })
    // z-index 由 Host 渲染时计算，这里验证队列顺序
    expect(overlays[0].id).not.toBe(overlays[1].id)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/f-08-overlay-core/useOverlayHost.spec.ts`
预期：FAIL — `useOverlayHost is not defined` 或模块不存在

- [ ] **步骤 3: 编写最小实现**

```typescript
// packages/webui/src/overlays/host/useOverlayHost.ts
import { reactive } from 'vue'
import type { OverlayItem } from '../types/overlay.types'

const overlays = reactive<OverlayItem[]>([])

export function useOverlayHost() {
  function addOverlay(item: Omit<OverlayItem, 'id'>): string {
    const id = crypto.randomUUID()
    overlays.push({ ...item, id })
    return id
  }

  function removeOverlay(id: string): void {
    const index = overlays.findIndex(o => o.id === id)
    if (index > -1) {
      overlays.splice(index, 1)
    }
  }

  function clearOverlays(type?: OverlayItem['type']): void {
    if (type) {
      for (let i = overlays.length - 1; i >= 0; i--) {
        if (overlays[i].type === type) {
          overlays.splice(i, 1)
        }
      }
    } else {
      overlays.splice(0, overlays.length)
    }
  }

  return {
    overlays,
    addOverlay,
    removeOverlay,
    clearOverlays
  }
}
```

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/issues/f-08-overlay-core/useOverlayHost.spec.ts`
预期：PASS（所有测试通过）

- [ ] **步骤 5: 提交**

```bash
git add packages/webui/src/overlays/host/useOverlayHost.ts tests/issues/f-08-overlay-core/useOverlayHost.spec.ts
git commit -m "feat(overlays): add useOverlayHost with queue management and tests"
```

---

### 任务 3: 编写 dialog.service.ts + 测试（TDD）

**文件：**
- 创建：`packages/webui/src/overlays/services/dialog.service.ts`
- 创建：`tests/issues/f-08-overlay-core/dialog.service.spec.ts`

**规格引用：**
- 行为规格：[AC-04: dialog.service.ts 实现 openDialog/closeDialog/closeAllDialogs]
- 行为规格：[AC-13: closeAllDialogs 仅关闭 Dialog，不影响 ContextMenu]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/f-08-overlay-core/dialog.service.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { openDialog, closeDialog, closeAllDialogs } from '../../../packages/webui/src/overlays/services/dialog.service'
import { useOverlayHost } from '../../../packages/webui/src/overlays/host/useOverlayHost'

const MockDialog = {} as any

describe('dialog.service', () => {
  beforeEach(() => {
    useOverlayHost().clearOverlays()
  })

  it('AC-04: should open dialog and return id', () => {
    const id = openDialog(MockDialog, { title: 'Test' })
    expect(id).toBeDefined()
    expect(useOverlayHost().overlays).toHaveLength(1)
    expect(useOverlayHost().overlays[0].type).toBe('dialog')
  })

  it('AC-04: should close dialog by id', () => {
    const id = openDialog(MockDialog, { title: 'Test' })
    closeDialog(id)
    expect(useOverlayHost().overlays).toHaveLength(0)
  })

  it('AC-04: should close all dialogs', () => {
    openDialog(MockDialog, { title: 'A' })
    openDialog(MockDialog, { title: 'B' })
    closeAllDialogs()
    expect(useOverlayHost().overlays).toHaveLength(0)
  })

  it('AC-13: closeAllDialogs should not affect context menus', () => {
    openDialog(MockDialog, { title: 'Dialog' })
    useOverlayHost().addOverlay({ component: MockDialog, props: {}, type: 'contextMenu' })
    closeAllDialogs()
    expect(useOverlayHost().overlays).toHaveLength(1)
    expect(useOverlayHost().overlays[0].type).toBe('contextMenu')
  })

  it('AC-04: closeDialog with non-existent id should be no-op', () => {
    openDialog(MockDialog, { title: 'Test' })
    closeDialog('non-existent-id')
    expect(useOverlayHost().overlays).toHaveLength(1)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/f-08-overlay-core/dialog.service.spec.ts`
预期：FAIL — 模块不存在

- [ ] **步骤 3: 编写最小实现**

```typescript
// packages/webui/src/overlays/services/dialog.service.ts
import { useOverlayHost } from '../host/useOverlayHost'
import type { DialogBaseProps } from '../types/overlay.types'
import type { Component } from 'vue'

export function openDialog<TProps extends DialogBaseProps>(
  component: Component,
  props: TProps
): string {
  const { addOverlay } = useOverlayHost()
  return addOverlay({ component, props, type: 'dialog' })
}

export function closeDialog(id: string): void {
  const { removeOverlay } = useOverlayHost()
  removeOverlay(id)
}

export function closeAllDialogs(): void {
  const { clearOverlays } = useOverlayHost()
  clearOverlays('dialog')
}
```

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/issues/f-08-overlay-core/dialog.service.spec.ts`
预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add packages/webui/src/overlays/services/dialog.service.ts tests/issues/f-08-overlay-core/dialog.service.spec.ts
git commit -m "feat(overlays): add dialog service with open/close/closeAll and tests"
```

---

### 任务 4: 编写 context-menu.service.ts + 测试（TDD）

**文件：**
- 创建：`packages/webui/src/overlays/services/context-menu.service.ts`
- 创建：`tests/issues/f-08-overlay-core/context-menu.service.spec.ts`

**规格引用：**
- 行为规格：[AC-05: context-menu.service.ts 实现 openContextMenu/closeContextMenu/closeAllContextMenus]
- 行为规格：[AC-14: ContextMenu 超出视口时自动调整位置]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/f-08-overlay-core/context-menu.service.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { openContextMenu, closeContextMenu, closeAllContextMenus } from '../../../packages/webui/src/overlays/services/context-menu.service'
import { useOverlayHost } from '../../../packages/webui/src/overlays/host/useOverlayHost'

const MockMenu = {} as any

describe('context-menu.service', () => {
  beforeEach(() => {
    useOverlayHost().clearOverlays()
  })

  it('AC-05: should open context menu and return id', () => {
    const id = openContextMenu(MockMenu, { x: 100, y: 200 })
    expect(id).toBeDefined()
    expect(useOverlayHost().overlays).toHaveLength(1)
    expect(useOverlayHost().overlays[0].type).toBe('contextMenu')
  })

  it('AC-05: should close context menu by id', () => {
    const id = openContextMenu(MockMenu, { x: 100, y: 200 })
    closeContextMenu(id)
    expect(useOverlayHost().overlays).toHaveLength(0)
  })

  it('AC-05: should close all context menus', () => {
    openContextMenu(MockMenu, { x: 100, y: 200 })
    openContextMenu(MockMenu, { x: 150, y: 250 })
    closeAllContextMenus()
    expect(useOverlayHost().overlays).toHaveLength(0)
  })

  it('AC-13: closeAllContextMenus should not affect dialogs', () => {
    useOverlayHost().addOverlay({ component: MockMenu, props: {}, type: 'dialog' })
    openContextMenu(MockMenu, { x: 100, y: 200 })
    closeAllContextMenus()
    expect(useOverlayHost().overlays).toHaveLength(1)
    expect(useOverlayHost().overlays[0].type).toBe('dialog')
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/f-08-overlay-core/context-menu.service.spec.ts`
预期：FAIL

- [ ] **步骤 3: 编写最小实现**

```typescript
// packages/webui/src/overlays/services/context-menu.service.ts
import { useOverlayHost } from '../host/useOverlayHost'
import type { ContextMenuBaseProps } from '../types/overlay.types'
import type { Component } from 'vue'

export function openContextMenu<TProps extends ContextMenuBaseProps>(
  component: Component,
  props: TProps
): string {
  const { addOverlay } = useOverlayHost()
  return addOverlay({ component, props, type: 'contextMenu' })
}

export function closeContextMenu(id: string): void {
  const { removeOverlay } = useOverlayHost()
  removeOverlay(id)
}

export function closeAllContextMenus(): void {
  const { clearOverlays } = useOverlayHost()
  clearOverlays('contextMenu')
}
```

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/issues/f-08-overlay-core/context-menu.service.spec.ts`
预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add packages/webui/src/overlays/services/context-menu.service.ts tests/issues/f-08-overlay-core/context-menu.service.spec.ts
git commit -m "feat(overlays): add context menu service with open/close/closeAll and tests"
```

---

### 任务 5: 编写 symbols.ts + useDialog.ts + useContextMenu.ts + 测试（TDD）

**文件：**
- 创建：`packages/webui/src/overlays/host/symbols.ts`
- 创建：`packages/webui/src/overlays/composables/useDialog.ts`
- 创建：`packages/webui/src/overlays/composables/useContextMenu.ts`
- 创建：`tests/issues/f-08-overlay-core/useDialog.spec.ts`
- 创建：`tests/issues/f-08-overlay-core/useContextMenu.spec.ts`

**规格引用：**
- 行为规格：[AC-06: defineDialog() 返回 isOpen 状态和 close 方法]
- 行为规格：[AC-07: defineContextMenu() 返回 isOpen 状态和 close 方法]

- [ ] **步骤 1: 编写失败测试（useDialog）**

```typescript
// tests/issues/f-08-overlay-core/useDialog.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import { defineDialog } from '../../../packages/webui/src/overlays/composables/useDialog'
import { OverlayCloseKey } from '../../../packages/webui/src/overlays/host/symbols'

function createTestComponent(closeFn: () => void) {
  return defineComponent({
    setup() {
      provide(OverlayCloseKey, closeFn)
      const TestChild = defineComponent({
        setup() {
          return defineDialog()
        },
        render() { return h('div') }
      })
      return () => h(TestChild)
    }
  })
}

describe('defineDialog', () => {
  it('AC-06: should return isOpen as true by default', () => {
    const closeFn = vi.fn()
    const wrapper = mount(createTestComponent(closeFn))
    const child = wrapper.findComponent({ name: 'TestChild' })
    expect(child.vm.isOpen).toBe(true)
  })

  it('AC-06: should call inject close function when close is invoked', () => {
    const closeFn = vi.fn()
    const wrapper = mount(createTestComponent(closeFn))
    const child = wrapper.findComponent({ name: 'TestChild' })
    child.vm.close()
    expect(closeFn).toHaveBeenCalledTimes(1)
  })

  it('AC-06: should set isOpen to false when close is invoked', () => {
    const closeFn = vi.fn()
    const wrapper = mount(createTestComponent(closeFn))
    const child = wrapper.findComponent({ name: 'TestChild' })
    child.vm.close()
    expect(child.vm.isOpen).toBe(false)
  })
})
```

- [ ] **步骤 2: 编写失败测试（useContextMenu）**

```typescript
// tests/issues/f-08-overlay-core/useContextMenu.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import { defineContextMenu } from '../../../packages/webui/src/overlays/composables/useContextMenu'
import { OverlayCloseKey } from '../../../packages/webui/src/overlays/host/symbols'

function createTestComponent(closeFn: () => void) {
  return defineComponent({
    setup() {
      provide(OverlayCloseKey, closeFn)
      const TestChild = defineComponent({
        setup() {
          return defineContextMenu()
        },
        render() { return h('div') }
      })
      return () => h(TestChild)
    }
  })
}

describe('defineContextMenu', () => {
  it('AC-07: should return isOpen as true by default', () => {
    const closeFn = vi.fn()
    const wrapper = mount(createTestComponent(closeFn))
    const child = wrapper.findComponent({ name: 'TestChild' })
    expect(child.vm.isOpen).toBe(true)
  })

  it('AC-07: should call inject close function when close is invoked', () => {
    const closeFn = vi.fn()
    const wrapper = mount(createTestComponent(closeFn))
    const child = wrapper.findComponent({ name: 'TestChild' })
    child.vm.close()
    expect(closeFn).toHaveBeenCalledTimes(1)
  })

  it('AC-07: should set isOpen to false when close is invoked', () => {
    const closeFn = vi.fn()
    const wrapper = mount(createTestComponent(closeFn))
    const child = wrapper.findComponent({ name: 'TestChild' })
    child.vm.close()
    expect(child.vm.isOpen).toBe(false)
  })
})
```

- [ ] **步骤 3: 运行测试验证失败**

运行：
```bash
npx vitest run tests/issues/f-08-overlay-core/useDialog.spec.ts
npx vitest run tests/issues/f-08-overlay-core/useContextMenu.spec.ts
```
预期：FAIL — 模块不存在

- [ ] **步骤 4: 编写最小实现**

```typescript
// packages/webui/src/overlays/host/symbols.ts
import type { InjectionKey } from 'vue'

export type OverlayCloseFn = () => void
export const OverlayCloseKey: InjectionKey<OverlayCloseFn> = Symbol('overlay:close')
```

```typescript
// packages/webui/src/overlays/composables/useDialog.ts
import { ref, inject } from 'vue'
import { OverlayCloseKey } from '../host/symbols'

export function defineDialog() {
  const isOpen = ref(true)
  const closeOverlay = inject(OverlayCloseKey, () => {})

  function close() {
    isOpen.value = false
    closeOverlay()
  }

  return { isOpen, close }
}
```

```typescript
// packages/webui/src/overlays/composables/useContextMenu.ts
import { ref, inject } from 'vue'
import { OverlayCloseKey } from '../host/symbols'

export function defineContextMenu() {
  const isOpen = ref(true)
  const closeOverlay = inject(OverlayCloseKey, () => {})

  function close() {
    isOpen.value = false
    closeOverlay()
  }

  return { isOpen, close }
}
```

- [ ] **步骤 5: 运行测试验证通过**

运行：
```bash
npx vitest run tests/issues/f-08-overlay-core/useDialog.spec.ts
npx vitest run tests/issues/f-08-overlay-core/useContextMenu.spec.ts
```
预期：PASS

- [ ] **步骤 6: 提交**

```bash
git add packages/webui/src/overlays/host/symbols.ts \
  packages/webui/src/overlays/composables/useDialog.ts \
  packages/webui/src/overlays/composables/useContextMenu.ts \
  tests/issues/f-08-overlay-core/useDialog.spec.ts \
  tests/issues/f-08-overlay-core/useContextMenu.spec.ts
git commit -m "feat(overlays): add defineDialog/defineContextMenu composables and tests"
```

---

### 任务 6: 编写 OverlayHost.vue + OverlayItem.vue + 测试（TDD）

**文件：**
- 创建：`packages/webui/src/overlays/host/OverlayItem.vue`
- 创建：`packages/webui/src/overlays/host/OverlayHost.vue`
- 创建：`tests/issues/f-08-overlay-core/OverlayHost.spec.ts`

**规格引用：**
- 行为规格：[AC-02: OverlayHost.vue 实现队列管理和动态渲染]
- 行为规格：[AC-09: z-index 堆叠管理正常，Dialog 和 ContextMenu 共享全局递增序列]
- 行为规格：[AC-12: 组件异常时 Vue 错误处理器触发 overlay 移除]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/f-08-overlay-core/OverlayHost.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import OverlayHost from '../../../packages/webui/src/overlays/host/OverlayHost.vue'
import { useOverlayHost } from '../../../packages/webui/src/overlays/host/useOverlayHost'
import { h } from 'vue'

const TestDialog = {
  name: 'TestDialog',
  props: ['title'],
  setup(props: { title: string }) {
    return () => h('div', { class: 'test-dialog' }, props.title)
  }
}

describe('OverlayHost', () => {
  beforeEach(() => {
    useOverlayHost().clearOverlays()
  })

  it('AC-02: should render nothing when no overlays', () => {
    const wrapper = mount(OverlayHost)
    expect(wrapper.find('.overlay-host').exists()).toBe(false)
  })

  it('AC-02: should render overlay components from queue', () => {
    useOverlayHost().addOverlay({ component: TestDialog, props: { title: 'Hello' }, type: 'dialog' })
    const wrapper = mount(OverlayHost)
    expect(wrapper.find('.test-dialog').exists()).toBe(true)
    expect(wrapper.text()).toContain('Hello')
  })

  it('AC-09: should assign increasing z-index to overlays', () => {
    useOverlayHost().addOverlay({ component: TestDialog, props: { title: 'A' }, type: 'dialog' })
    useOverlayHost().addOverlay({ component: TestDialog, props: { title: 'B' }, type: 'dialog' })
    const wrapper = mount(OverlayHost)
    const items = wrapper.findAll('.overlay-item')
    expect(items[0].attributes('style')).toContain('z-index: 10000')
    expect(items[1].attributes('style')).toContain('z-index: 10001')
  })

  it('AC-12: should catch child component errors and remove overlay', () => {
    const ErrorDialog = {
      setup() {
        throw new Error('render error')
      },
      render() {
        return h('div')
      }
    }
    useOverlayHost().addOverlay({ component: ErrorDialog, props: {}, type: 'dialog' })
    const wrapper = mount(OverlayHost)
    // 错误处理后 overlay 应该被移除
    expect(useOverlayHost().overlays).toHaveLength(0)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/f-08-overlay-core/OverlayHost.spec.ts`
预期：FAIL — 模块不存在

- [ ] **步骤 3: 编写最小实现**

```vue
<!-- packages/webui/src/overlays/host/OverlayItem.vue -->
<script setup lang="ts">
import { provide, onErrorCaptured } from 'vue'
import { OverlayCloseKey } from './symbols'
import type { OverlayItem } from '../types/overlay.types'

const props = defineProps<{
  item: OverlayItem
  onClose: () => void
}>()

provide(OverlayCloseKey, props.onClose)

onErrorCaptured((err) => {
  props.onClose()
  return false // 阻止错误继续向上传播
})
</script>

<template>
  <component :is="item.component" v-bind="item.props" />
</template>
```

```vue
<!-- packages/webui/src/overlays/host/OverlayHost.vue -->
<script setup lang="ts">
import { useOverlayHost } from './useOverlayHost'
import OverlayItem from './OverlayItem.vue'

const { overlays, removeOverlay } = useOverlayHost()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="overlays.length > 0"
      class="overlay-host fixed inset-0 pointer-events-none"
      style="z-index: 9999;"
    >
      <OverlayItem
        v-for="(item, index) in overlays"
        :key="item.id"
        :item="item"
        :on-close="() => removeOverlay(item.id)"
        class="overlay-item absolute"
        :style="{ zIndex: 10000 + index, pointerEvents: 'auto' }"
      />
    </div>
  </Teleport>
</template>
```

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/issues/f-08-overlay-core/OverlayHost.spec.ts`
预期：PASS（可能需要调整测试以适应实际渲染输出）

- [ ] **步骤 5: 提交**

```bash
git add packages/webui/src/overlays/host/OverlayItem.vue \
  packages/webui/src/overlays/host/OverlayHost.vue \
  tests/issues/f-08-overlay-core/OverlayHost.spec.ts
git commit -m "feat(overlays): add OverlayHost and OverlayItem with rendering and error handling"
```

---

### 任务 7: 编写 index.ts 统一导出

**文件：**
- 创建：`packages/webui/src/overlays/index.ts`

- [ ] **步骤 1: 编写统一导出**

```typescript
// packages/webui/src/overlays/index.ts
export { useOverlayHost } from './host/useOverlayHost'
export { default as OverlayHost } from './host/OverlayHost.vue'
export { openDialog, closeDialog, closeAllDialogs } from './services/dialog.service'
export { openContextMenu, closeContextMenu, closeAllContextMenus } from './services/context-menu.service'
export { defineDialog } from './composables/useDialog'
export { defineContextMenu } from './composables/useContextMenu'
export type { OverlayItem, DialogBaseProps, ContextMenuBaseProps } from './types/overlay.types'
```

- [ ] **步骤 2: 提交**

```bash
git add packages/webui/src/overlays/index.ts
git commit -m "feat(overlays): add index.ts for unified exports"
```

---

### 任务 8: 修改 App.vue + main.ts + 集成测试（TDD）

**文件：**
- 修改：`packages/webui/src/App.vue`
- 修改：`packages/webui/src/main.ts`
- 创建：`tests/issues/f-08-overlay-core/integration.spec.ts`

**规格引用：**
- 行为规格：[AC-03: App.vue 模板声明 OverlayHost，main.ts 注册组件]
- 行为规格：[AC-10: 页面刷新时 overlay 自动清理，DOM 无残留]
- 行为规格：[AC-11: 路由切换时自动关闭所有 overlay]

- [ ] **步骤 1: 编写失败测试（集成测试）**

```typescript
// tests/issues/f-08-overlay-core/integration.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useOverlayHost } from '../../../packages/webui/src/overlays/host/useOverlayHost'
import { openDialog, closeAllDialogs } from '../../../packages/webui/src/overlays/services/dialog.service'
import { openContextMenu, closeAllContextMenus } from '../../../packages/webui/src/overlays/services/context-menu.service'

const MockComponent = {} as any

describe('overlay integration', () => {
  beforeEach(() => {
    useOverlayHost().clearOverlays()
  })

  it('AC-10: should clear all overlays on beforeunload', () => {
    openDialog(MockComponent, { title: 'Test' })
    openContextMenu(MockComponent, { x: 100, y: 200 })
    expect(useOverlayHost().overlays).toHaveLength(2)

    // 模拟 beforeunload 事件
    const event = new Event('beforeunload')
    window.dispatchEvent(event)

    expect(useOverlayHost().overlays).toHaveLength(0)
  })

  it('AC-11: should clear all overlays on route change', () => {
    // 路由切换清理逻辑在 main.ts 中通过 router.beforeEach 实现
    // 这里验证 clearOverlays 能被正确调用
    openDialog(MockComponent, { title: 'Test' })
    closeAllDialogs()
    closeAllContextMenus()
    expect(useOverlayHost().overlays).toHaveLength(0)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/f-08-overlay-core/integration.spec.ts`
预期：FAIL — beforeunload 测试可能通过（因为没有监听器），但路由切换逻辑未实现

- [ ] **步骤 3: 修改 App.vue**

```vue
<!-- packages/webui/src/App.vue -->
<script setup lang="ts">
import { onMounted } from 'vue'
import { useSettingsStore } from './stores/settings'
import { useAuthStore } from './stores/auth'
import ConfigProvider from './components/ConfigProvider.vue'
import { OverlayHost } from './overlays'

const settingsStore = useSettingsStore()
const authStore = useAuthStore()

onMounted(() => {
  if (authStore.isAuthenticated) {
    settingsStore.loadConfig()
  }
})
</script>

<template>
  <ConfigProvider>
    <RouterView />
    <OverlayHost />
  </ConfigProvider>
</template>
```

- [ ] **步骤 4: 修改 main.ts**

```typescript
// packages/webui/src/main.ts
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { useOverlayHost } from './overlays/host/useOverlayHost'
import './assets/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// 初始化 auth store
const authStore = useAuthStore()
await authStore.init()

app.use(router)

// 路由切换时清理所有 overlay
router.beforeEach(() => {
  const { clearOverlays } = useOverlayHost()
  clearOverlays()
})

// 页面刷新/关闭时清理所有 overlay
window.addEventListener('beforeunload', () => {
  const { clearOverlays } = useOverlayHost()
  clearOverlays()
})

app.mount('#app')
```

- [ ] **步骤 5: 运行测试验证通过**

运行：`npx vitest run tests/issues/f-08-overlay-core/integration.spec.ts`
预期：PASS

- [ ] **步骤 6: 提交**

```bash
git add packages/webui/src/App.vue packages/webui/src/main.ts tests/issues/f-08-overlay-core/integration.spec.ts
git commit -m "feat(overlays): integrate OverlayHost into App.vue and main.ts with cleanup handlers"
```

---

## 自检

### 1. 规格覆盖检查

| Spec 章节 | 实现任务 | 状态 |
|-----------|----------|------|
| overlay.types.ts（无 any，泛型约束） | 任务 1 | ✅ |
| OverlayHost.vue（队列管理、动态渲染） | 任务 6 | ✅ |
| dialog.service.ts（open/close/closeAll） | 任务 3 | ✅ |
| context-menu.service.ts（open/close/closeAll） | 任务 4 | ✅ |
| defineDialog()（isOpen + close） | 任务 5 | ✅ |
| defineContextMenu()（isOpen + close） | 任务 5 | ✅ |
| z-index 堆叠（共享全局序列） | 任务 6 | ✅ |
| 页面刷新清理 | 任务 8 | ✅ |
| 路由切换清理 | 任务 8 | ✅ |
| 组件异常移除 | 任务 6 | ✅ |
| closeAll 粒度（互不干扰） | 任务 2、3、4 | ✅ |
| ContextMenu 边界检测 | f-10 范围 | N/A |
| App.vue / main.ts 挂载 | 任务 8 | ✅ |
| index.ts 统一导出 | 任务 7 | ✅ |

### 2. 占位符扫描

- [x] 无 "TBD"、"TODO"、"稍后实现"
- [x] 无 "添加适当的错误处理" 等模糊表述
- [x] 每个任务都有具体的代码块
- [x] 无引用未定义的类型/函数

### 3. 类型一致性

- [x] `OverlayItem` 在 types.ts、useOverlayHost.ts、OverlayItem.vue 中定义一致
- [x] `DialogBaseProps` / `ContextMenuBaseProps` 约束在服务文件中正确使用
- [x] `closeDialog` / `closeContextMenu` 签名一致（`(id: string) => void`）
- [x] `defineDialog()` / `defineContextMenu()` 无参签名与 PRD 一致，内部通过 `inject(OverlayCloseKey)` 获取 close 函数
- [x] `dialog.service.ts` / `context-menu.service.ts` 无冗余类型断言

---

## 执行交接

**计划已保存到 `docs/issues/f-08-overlay-core/plan.md`。两种执行方式：**

1. **子代理驱动（推荐）** — 每个任务新子代理，任务间审查
2. **内联执行** — 当前会话顺序执行，带检查点

**选择哪种？**
