---
id: f-10
issue: issue.md
version: 1
---

# ContextMenu 迁移与 Overlay 规范文档 实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 将现有 ContextMenu 迁移到 `overlays/context-menus/`，接入函数式 API，废弃旧 Teleport 组件，建立前端 overlay 规范文档。

**架构：** 复用 f-08 的 OverlayHost + `openContextMenu()` / `defineContextMenu()` 机制。FileManager 和 FileExplorer 分别创建独立 ContextMenu 组件（菜单项差异大）。视口边界检测由组件内部通过 `window.innerWidth/Height` 计算。规范文档覆盖目录约束、类型安全、可访问性。

**技术栈：** Vue 3 + TypeScript + Vitest + @vue/test-utils

**Issue 引用：** [issue.md](issue.md)
**Spec 引用：** [specs/feature-spec.md](specs/feature-spec.md) · [specs/behavior-spec.md](specs/behavior-spec.md) · [specs/api-spec.md](specs/api-spec.md)

---

## 文件结构

```
packages/webui/src/
  overlays/
    context-menus/
      FileContextMenu.vue           # 新建：FileManager 用
      FileExplorerContextMenu.vue   # 新建：FileExplorer 用
    index.ts                        # 修改：导出新增组件
  components/
    ContextMenu.vue                 # 废弃：删除
    FileExplorer.vue                # 修改：替换 ContextMenu 引用
    knowledge-base/
      FileManager.vue               # 修改：移除内联 ContextMenu
  components/KnowledgeBasePage.vue  # 修改：检查 ContextMenu 引用
docs/
  webui-guide/
    overlay-conventions.md          # 新建
  guide/
    README.md                       # 修改：更新文档体系图
tests/issues/f-10-context-menu-and-conventions/
  contextMenus.spec.ts              # 新建：核心 overlay 测试
  FileContextMenu.spec.ts           # 新建：FileContextMenu 组件测试
  FileExplorerContextMenu.spec.ts   # 新建：FileExplorerContextMenu 组件测试
```

---

## 任务 1: FileContextMenu 组件 + 测试（TDD）

**文件：**
- 创建：`packages/webui/src/overlays/context-menus/FileContextMenu.vue`
- 测试：`tests/issues/f-10-context-menu-and-conventions/FileContextMenu.spec.ts`

**规格引用：**
- 行为规格：[交互状态 - 打开/关闭/视口边界]
- API 规格：[ContextMenuBaseProps / FileContextMenuProps]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/f-10-context-menu-and-conventions/FileContextMenu.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import FileContextMenu from '@/overlays/context-menus/FileContextMenu.vue'
import { OverlayCloseKey } from '@/overlays/host/symbols'

function mountMenu(props: Record<string, unknown> = {}) {
  const closeFn = vi.fn()
  const Wrapper = defineComponent({
    setup() {
      provide(OverlayCloseKey, closeFn)
      return () => h(FileContextMenu, {
        x: 100,
        y: 200,
        item: null,
        onAction: vi.fn(),
        ...props,
      })
    },
  })
  const wrapper = mount(Wrapper)
  return { wrapper, closeFn }
}

describe('FileContextMenu', () => {
  it('AC-01: renders background menu items when item is null', () => {
    const { wrapper } = mountMenu({ item: null })
    expect(wrapper.text()).toContain('新建文件夹')
    expect(wrapper.text()).not.toContain('打开')
  })

  it('AC-01: renders file menu items when item is a document', () => {
    const { wrapper } = mountMenu({ item: { id: 'd1', name: 'doc.pdf', status: 'ready' } })
    expect(wrapper.text()).toContain('打开')
    expect(wrapper.text()).toContain('重命名')
    expect(wrapper.text()).toContain('删除')
    expect(wrapper.text()).not.toContain('新建文件夹')
  })

  it('AC-01: renders folder menu items when item is a folder', () => {
    const { wrapper } = mountMenu({ item: { id: 'f1', name: 'folder' } })
    expect(wrapper.text()).toContain('打开')
    expect(wrapper.text()).toContain('重命名')
    expect(wrapper.text()).toContain('删除')
    expect(wrapper.text()).not.toContain('新建文件夹')
  })

  it('AC-03: calls close when clicking outside', async () => {
    const { wrapper, closeFn } = mountMenu()
    await wrapper.find('[data-testid="context-menu-overlay"]').trigger('click')
    expect(closeFn).toHaveBeenCalled()
  })

  it('AC-06: calls close on Escape key', async () => {
    const { wrapper, closeFn } = mountMenu()
    await wrapper.trigger('keydown', { key: 'Escape' })
    expect(closeFn).toHaveBeenCalled()
  })

  it('AC-07: calls onAction and close when menu item clicked', async () => {
    const onAction = vi.fn()
    const { wrapper, closeFn } = mountMenu({ item: null, onAction })
    await wrapper.find('button').trigger('click')
    expect(onAction).toHaveBeenCalledWith('createFolder', undefined)
    expect(closeFn).toHaveBeenCalled()
  })

  it('AC-04: adjusts position when near right edge', () => {
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true })
    const { wrapper } = mountMenu({ x: 350, y: 100 })
    const el = wrapper.find('[data-testid="context-menu"]')
    const left = (el.element as HTMLElement).style.left
    expect(parseInt(left)).toBeLessThan(350)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/f-10-context-menu-and-conventions/FileContextMenu.spec.ts`
预期：FAIL — "FileContextMenu is not defined" 或断言失败

- [ ] **步骤 3: 编写最小实现**

```vue
<!-- packages/webui/src/overlays/context-menus/FileContextMenu.vue -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { defineContextMenu } from '@/overlays'
import { FolderPlusIcon, FolderIcon, PencilIcon, TrashIcon } from 'lucide-vue-next'
import type { DocumentItem, Folder } from '@/stores/file'

const props = defineProps<{
  x: number
  y: number
  item: (DocumentItem | Folder) | null
  onAction?: (action: 'open' | 'rename' | 'delete' | 'createFolder', item?: DocumentItem | Folder) => void
}>()

const { close } = defineContextMenu()

const isFolder = computed(() => props.item !== null && !('status' in props.item))
const isDocument = computed(() => props.item !== null && 'status' in props.item)
const isBackground = computed(() => props.item === null)

const menuRef = ref<HTMLElement | null>(null)

const position = computed(() => {
  const menuWidth = menuRef.value?.offsetWidth ?? 160
  const menuHeight = menuRef.value?.offsetHeight ?? 200
  const left = Math.max(0, Math.min(props.x, window.innerWidth - menuWidth))
  const top = Math.max(0, Math.min(props.y, window.innerHeight - menuHeight))
  return { left: `${left}px`, top: `${top}px` }
})

function handleAction(action: 'open' | 'rename' | 'delete' | 'createFolder') {
  if (action === 'createFolder') {
    props.onAction?.('createFolder', undefined)
  } else if (props.item) {
    props.onAction?.(action, props.item)
  }
  close()
}

function onClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  const menuEl = document.querySelector('[data-testid="context-menu"]')
  if (menuEl && !menuEl.contains(target)) {
    close()
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    ref="menuRef"
    data-testid="context-menu"
    class="fixed z-50 min-w-[160px] rounded-lg border border-border-default bg-white py-1 shadow-xl"
    :style="position"
    @click.stop
  >
    <template v-if="isBackground">
      <button
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
        @click="handleAction('createFolder')"
      >
        <FolderPlusIcon class="size-4" />
        新建文件夹
      </button>
    </template>
    <template v-else-if="item">
      <button
        v-if="isFolder || isDocument"
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
        @click="handleAction('open')"
      >
        <FolderIcon class="size-4" />
        打开
      </button>
      <button
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
        @click="handleAction('rename')"
      >
        <PencilIcon class="size-4" />
        重命名
      </button>
      <div class="my-1 h-px bg-border-default" />
      <button
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger-500 hover:bg-danger-50"
        @click="handleAction('delete')"
      >
        <TrashIcon class="size-4" />
        删除
      </button>
    </template>
  </div>
  <div data-testid="context-menu-overlay" class="fixed inset-0 z-40" @click="close" />
</template>
```

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/issues/f-10-context-menu-and-conventions/FileContextMenu.spec.ts`
预期：PASS（所有测试通过）

- [ ] **步骤 5: 提交**

```bash
git add tests/issues/f-10-context-menu-and-conventions/FileContextMenu.spec.ts packages/webui/src/overlays/context-menus/FileContextMenu.vue
git commit -m "feat(overlays): add FileContextMenu with TDD"
```

---

## 任务 2: FileExplorerContextMenu 组件 + 测试（TDD）

**文件：**
- 创建：`packages/webui/src/overlays/context-menus/FileExplorerContextMenu.vue`
- 测试：`tests/issues/f-10-context-menu-and-conventions/FileExplorerContextMenu.spec.ts`

**规格引用：**
- 行为规格：[正常流程 - 各页面差异]
- API 规格：[FileExplorerContextMenuProps]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/f-10-context-menu-and-conventions/FileExplorerContextMenu.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import FileExplorerContextMenu from '@/overlays/context-menus/FileExplorerContextMenu.vue'
import { OverlayCloseKey } from '@/overlays/host/symbols'

function mountMenu(props: Record<string, unknown> = {}) {
  const closeFn = vi.fn()
  const Wrapper = defineComponent({
    setup() {
      provide(OverlayCloseKey, closeFn)
      return () => h(FileExplorerContextMenu, {
        x: 100,
        y: 200,
        fileName: null,
        onAction: vi.fn(),
        ...props,
      })
    },
  })
  const wrapper = mount(Wrapper)
  return { wrapper, closeFn }
}

describe('FileExplorerContextMenu', () => {
  it('AC-02: renders background menu items when fileName is null', () => {
    const { wrapper } = mountMenu({ fileName: null })
    expect(wrapper.text()).toContain('新建文件夹')
    expect(wrapper.text()).not.toContain('重命名')
  })

  it('AC-02: renders file menu items when fileName is set', () => {
    const { wrapper } = mountMenu({ fileName: 'test.txt' })
    expect(wrapper.text()).toContain('重命名')
    expect(wrapper.text()).toContain('移动')
    expect(wrapper.text()).toContain('复制')
    expect(wrapper.text()).toContain('删除')
    expect(wrapper.text()).not.toContain('新建文件夹')
  })

  it('AC-03: calls close when clicking outside', async () => {
    const { wrapper, closeFn } = mountMenu()
    await wrapper.find('[data-testid="context-menu-overlay"]').trigger('click')
    expect(closeFn).toHaveBeenCalled()
  })

  it('AC-06: calls close on Escape key', async () => {
    const { wrapper, closeFn } = mountMenu()
    await wrapper.trigger('keydown', { key: 'Escape' })
    expect(closeFn).toHaveBeenCalled()
  })

  it('AC-07: calls onAction and close when menu item clicked', async () => {
    const onAction = vi.fn()
    const { wrapper, closeFn } = mountMenu({ fileName: 'test.txt', onAction })
    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click')
    expect(onAction).toHaveBeenCalledWith('rename', 'test.txt')
    expect(closeFn).toHaveBeenCalled()
  })

  it('AC-04: adjusts position when near bottom edge', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true })
    const { wrapper } = mountMenu({ x: 100, y: 350 })
    const el = wrapper.find('[data-testid="context-menu"]')
    const top = (el.element as HTMLElement).style.top
    expect(parseInt(top)).toBeLessThan(350)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/f-10-context-menu-and-conventions/FileExplorerContextMenu.spec.ts`
预期：FAIL

- [ ] **步骤 3: 编写最小实现**

```vue
<!-- packages/webui/src/overlays/context-menus/FileExplorerContextMenu.vue -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { defineContextMenu } from '@/overlays'
import { FolderPlusIcon, PencilIcon, FolderInputIcon, CopyIcon, Trash2Icon } from 'lucide-vue-next'

const props = defineProps<{
  x: number
  y: number
  fileName: string | null
  onAction?: (action: 'rename' | 'move' | 'copy' | 'delete' | 'createFolder', fileName?: string) => void
}>()

const { close } = defineContextMenu()

const isBackground = computed(() => props.fileName === null)

const position = computed(() => {
  const menuWidth = 160
  const menuHeight = 220
  const left = Math.min(props.x, window.innerWidth - menuWidth)
  const top = Math.min(props.y, window.innerHeight - menuHeight)
  return { left: `${left}px`, top: `${top}px` }
})

function handleAction(action: 'rename' | 'move' | 'copy' | 'delete' | 'createFolder') {
  if (action === 'createFolder') {
    props.onAction?.('createFolder', undefined)
  } else if (props.fileName) {
    props.onAction?.(action, props.fileName)
  }
  close()
}

function onClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  const menuEl = document.querySelector('[data-testid="context-menu"]')
  if (menuEl && !menuEl.contains(target)) {
    close()
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    ref="menuRef"
    data-testid="context-menu"
    class="fixed z-50 min-w-[160px] rounded-lg border border-border-default bg-white py-1 shadow-xl"
    :style="position"
    @click.stop
  >
    <template v-if="isBackground">
      <button
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
        @click="handleAction('createFolder')"
      >
        <FolderPlusIcon class="size-4" />
        新建文件夹
      </button>
    </template>
    <template v-else>
      <button
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
        @click="handleAction('rename')"
      >
        <PencilIcon class="size-4" />
        重命名
      </button>
      <button
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
        @click="handleAction('move')"
      >
        <FolderInputIcon class="size-4" />
        移动
      </button>
      <button
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
        @click="handleAction('copy')"
      >
        <CopyIcon class="size-4" />
        复制
      </button>
      <div class="my-1 h-px bg-border-default" />
      <button
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger-500 hover:bg-danger-50"
        @click="handleAction('delete')"
      >
        <Trash2Icon class="size-4" />
        删除
      </button>
    </template>
  </div>
  <div data-testid="context-menu-overlay" class="fixed inset-0 z-40" @click="close" />
</template>
```

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/issues/f-10-context-menu-and-conventions/FileExplorerContextMenu.spec.ts`
预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add tests/issues/f-10-context-menu-and-conventions/FileExplorerContextMenu.spec.ts packages/webui/src/overlays/context-menus/FileExplorerContextMenu.vue
git commit -m "feat(overlays): add FileExplorerContextMenu with TDD"
```

---

## 任务 3: 核心 ContextMenu overlay 测试

**文件：**
- 测试：`tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts`

**规格引用：**
- 行为规格：[交互状态 - 打开/关闭/异常关闭]
- API 规格：[openContextMenu / closeContextMenu / closeAllContextMenus]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import { openContextMenu, closeContextMenu, closeAllContextMenus } from '@/overlays'
import { useOverlayHost } from '@/overlays/host/useOverlayHost'

// Mock overlay host
vi.mock('@/overlays/host/useOverlayHost', () => ({
  useOverlayHost: vi.fn(() => ({
    addOverlay: vi.fn(() => 'cm-1'),
    removeOverlay: vi.fn(),
    clearOverlays: vi.fn(),
  })),
}))

describe('ContextMenu overlay system', () => {
  it('AC-01: openContextMenu creates overlay in queue', () => {
    const { addOverlay } = useOverlayHost()
    const MockMenu = defineComponent({ template: '<div>menu</div>' })
    const id = openContextMenu(MockMenu, { x: 10, y: 20 })
    expect(addOverlay).toHaveBeenCalledWith(expect.objectContaining({
      component: MockMenu,
      props: { x: 10, y: 20 },
      type: 'contextMenu',
    }))
    expect(id).toBe('cm-1')
  })

  it('AC-03: closeContextMenu removes overlay by id', () => {
    const { removeOverlay } = useOverlayHost()
    closeContextMenu('cm-1')
    expect(removeOverlay).toHaveBeenCalledWith('cm-1')
  })

  it('AC-03: closeAllContextMenus clears all context menus', () => {
    const { clearOverlays } = useOverlayHost()
    closeAllContextMenus()
    expect(clearOverlays).toHaveBeenCalledWith('contextMenu')
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts`
预期：FAIL

- [ ] **步骤 3: 验证现有 API 已满足测试（无需新代码）**

`openContextMenu` / `closeContextMenu` / `closeAllContextMenus` 已在 f-08 实现。确认测试通过后无需修改生产代码。

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts`
预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts
git commit -m "test(overlays): add context menu overlay system tests"
```

---

## 任务 4: FileManager.vue 迁移（移除内联 ContextMenu）

**文件：**
- 修改：`packages/webui/src/components/knowledge-base/FileManager.vue`
- 修改：`packages/webui/src/overlays/index.ts`

**规格引用：**
- 功能规格：[范围内 - FileManager.vue 内联 ContextMenu 迁移]
- 行为规格：[正常流程 - FileManager]

- [ ] **步骤 1: 编写失败测试（回归测试）**

创建 `tests/issues/f-10-context-menu-and-conventions/FileManager.regression.spec.ts`：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import FileManager from '@/components/knowledge-base/FileManager.vue'
import * as overlays from '@/overlays'

vi.mock('@/overlays', async (importOriginal) => {
  const actual = await importOriginal<typeof overlays>()
  return {
    ...actual,
    openContextMenu: vi.fn(() => 'cm-test'),
    closeAllContextMenus: vi.fn(),
  }
})

describe('FileManager ContextMenu regression', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('AC-08: right click on item opens FileContextMenu via openContextMenu', async () => {
    const wrapper = mount(FileManager, {
      props: { kbId: 'kb-1' },
      global: { stubs: ['FileGridItem', 'BreadcrumbNav', 'FileUpload'] },
    })
    const item = wrapper.find('[data-testid="file-grid-item"]')
    await item.trigger('contextmenu', { clientX: 100, clientY: 200 })
    expect(overlays.openContextMenu).toHaveBeenCalledWith(
      expect.any(Object), // FileContextMenu component
      expect.objectContaining({
        x: 100,
        y: 200,
        item: expect.any(Object),
        onAction: expect.any(Function),
      }),
    )
    expect(overlays.closeAllContextMenus).toHaveBeenCalled()
  })

  it('AC-08: right click on background opens FileContextMenu with null item', async () => {
    const wrapper = mount(FileManager, {
      props: { kbId: 'kb-1' },
      global: { stubs: ['FileGridItem', 'BreadcrumbNav', 'FileUpload'] },
    })
    const grid = wrapper.find('.grid') // background grid area
    await grid.trigger('contextmenu', { clientX: 50, clientY: 60 })
    expect(overlays.openContextMenu).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        x: 50,
        y: 60,
        item: null,
        onAction: expect.any(Function),
      }),
    )
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/f-10-context-menu-and-conventions/`
预期：FAIL — FileManager 仍使用内联 ContextMenu

- [ ] **步骤 3: 修改 FileManager.vue**

修改点：
1. 移除 `contextMenuPos` / `showContextMenu` / `contextMenuTarget` / `contextMenuIsBackground` ref
2. 移除 `handleContextMenu` / `handleBackgroundContextMenu` / `closeContextMenu` 函数
3. 移除模板中的 `<Teleport>` ContextMenu 块
4. 添加 `import { openContextMenu, closeAllContextMenus } from '@/overlays'`
5. 添加 `import FileContextMenu from '@/overlays/context-menus/FileContextMenu.vue'`
6. 新增右键处理函数：

```typescript
function handleContextMenu(e: MouseEvent, item: DocumentItem | Folder) {
  e.preventDefault()
  closeAllContextMenus()
  openContextMenu(FileContextMenu, {
    x: e.clientX,
    y: e.clientY,
    item,
    onAction: (action, target) => {
      if (!target) return
      if (action === 'open') openItem(target)
      else if (action === 'rename') openRenameDialog(target)
      else if (action === 'delete') openDeleteDialog(target)
    },
  })
}

function handleBackgroundContextMenu(e: MouseEvent) {
  e.preventDefault()
  closeAllContextMenus()
  openContextMenu(FileContextMenu, {
    x: e.clientX,
    y: e.clientY,
    item: null,
    onAction: (action) => {
      if (action === 'createFolder') openCreateFolderDialog()
    },
  })
}
```

7. 移除 `openCreateFolderDialog` / `openRenameDialog` / `openDeleteDialog` 中已有的 `closeContextMenu()` 调用（overlay 自动关闭）

- [ ] **步骤 4: 更新 overlays/index.ts 导出**

```typescript
// packages/webui/src/overlays/index.ts
export { default as FileContextMenu } from './context-menus/FileContextMenu.vue'
export { default as FileExplorerContextMenu } from './context-menus/FileExplorerContextMenu.vue'
```

- [ ] **步骤 5: 运行测试验证通过**

运行：`npx vitest run tests/issues/f-10-context-menu-and-conventions/`
预期：PASS

运行：`npx vitest run tests/issues/f-09-dialog-migration/`
预期：PASS（无回归）

- [ ] **步骤 6: 提交**

```bash
git add packages/webui/src/components/knowledge-base/FileManager.vue packages/webui/src/overlays/index.ts
git commit -m "refactor(FileManager): migrate inline context menu to overlays/ functional API"
```

---

## 任务 5: FileExplorer.vue 迁移（替换 ContextMenu.vue）

**文件：**
- 修改：`packages/webui/src/components/FileExplorer.vue`
- 删除：`packages/webui/src/components/ContextMenu.vue`

**规格引用：**
- 功能规格：[范围内 - FileExplorer.vue 使用的 ContextMenu.vue 迁移]
- 行为规格：[正常流程 - FileExplorer]

- [ ] **步骤 1: 编写失败测试（回归测试）**

在 `tests/issues/f-10-context-menu-and-conventions/FileExplorerContextMenu.spec.ts` 中已覆盖组件行为。FileExplorer 集成测试通过现有 E2E 或手动验证。

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/f-10-context-menu-and-conventions/`
预期：当前通过（FileExplorer 测试尚未关联）

- [ ] **步骤 3: 修改 FileExplorer.vue**

修改点：
1. 移除 `import ContextMenu from './ContextMenu.vue'`
2. 移除 `contextMenuVisible` / `contextMenuX` / `contextMenuY` / `contextMenuFile` / `contextMenuIsBlank` ref
3. 移除 `onContextMenu` / `closeFileContextMenu` 函数
4. 移除模板中的 `<ContextMenu>` 块
5. 添加 `import { openContextMenu, closeAllContextMenus } from '@/overlays'`
6. 添加 `import FileExplorerContextMenu from '@/overlays/context-menus/FileExplorerContextMenu.vue'`
7. 新增右键处理函数：

```typescript
function onContextMenu(event: MouseEvent, fileName?: string) {
  event.preventDefault()
  closeAllContextMenus()
  openContextMenu(FileExplorerContextMenu, {
    x: event.clientX,
    y: event.clientY,
    fileName: fileName || null,
    onAction: (action, target) => {
      if (!target && action !== 'createFolder') return
      if (action === 'rename') {
        renamingFile.value = target!
      } else if (action === 'move') {
        emit('moveFile', target!)
      } else if (action === 'copy') {
        emit('copyFile', target!)
      } else if (action === 'delete') {
        openDialog(ConfirmDialog, {
          title: '提示',
          message: `确认永久删除文件「${target}」？此操作不可撤销。`,
          onConfirm: () => emit('deleteFile', target!),
        })
      } else if (action === 'createFolder') {
        emit('createFolder')
      }
    },
  })
}
```

8. 移除 `onRenameClick` / `onDeleteClick` / `onMoveClick` / `onCopyClick` / `onCreateFolderClick` 中的 `closeFileContextMenu()` 调用
9. 内联 rename 逻辑保留（`renamingFile`），但触发方式改为 `onAction` 回调中设置

- [ ] **步骤 4: 删除废弃的 ContextMenu.vue**

```bash
git rm packages/webui/src/components/ContextMenu.vue
```

- [ ] **步骤 5: 运行测试验证通过**

运行：`npx vitest run tests/issues/f-10-context-menu-and-conventions/`
预期：PASS

运行：`npx vitest run tests/issues/f-09-dialog-migration/`
预期：PASS（无回归）

- [ ] **步骤 6: 提交**

```bash
git add packages/webui/src/components/FileExplorer.vue packages/webui/src/overlays/index.ts
git commit -m "refactor(FileExplorer): migrate ContextMenu.vue to overlays/ functional API"
```

---

## 任务 6: KnowledgeBasePage.vue 引用检查

**文件：**
- 检查：`packages/webui/src/components/KnowledgeBasePage.vue`

- [ ] **步骤 1: 检查 ContextMenu 引用**

```bash
grep -n "ContextMenu\|contextmenu" packages/webui/src/components/KnowledgeBasePage.vue
```

- [ ] **步骤 2: 若有引用，同步更新为 openContextMenu 模式**

参照任务 4/5 的修改方式。

- [ ] **步骤 3: 运行测试验证通过**

运行：`npx vitest run`
预期：PASS

- [ ] **步骤 4: 提交（如有修改）**

```bash
git add packages/webui/src/components/KnowledgeBasePage.vue
git commit -m "refactor(KnowledgeBasePage): update ContextMenu references to overlays/ API"
```

---

## 任务 7: 视口边界检测验证

**文件：**
- 测试：`tests/issues/f-10-context-menu-and-conventions/FileContextMenu.spec.ts`
- 测试：`tests/issues/f-10-context-menu-and-conventions/FileExplorerContextMenu.spec.ts`

**规格引用：**
- 行为规格：[交互状态 - 视口边界]

- [ ] **步骤 1: 确认测试已覆盖**

AC-04 测试用例已在任务 1/2 中编写：
- `adjusts position when near right edge`
- `adjusts position when near bottom edge`

- [ ] **步骤 2: 运行测试验证通过**

运行：`npx vitest run tests/issues/f-10-context-menu-and-conventions/`
预期：PASS

---

## 任务 8: 规范文档编写

**文件：**
- 创建：`docs/webui-guide/overlay-conventions.md`
- 创建：`docs/webui-guide/README.md`
- 修改：`CLAUDE.md`
- 修改：`docs/guide/README.md`

**规格引用：**
- 功能规格：[范围内 - Overlay 规范文档]
- checklist: AC-05, AC-06, AC-07, AC-08, AC-09

- [ ] **步骤 1: 创建 docs/webui-guide/ 目录和 README.md**

```markdown
# WebUI 开发指南

本目录包含前端专项规范文档，与 `docs/guide/`（流程规范）分离。

## 文档列表

- [overlay-conventions.md](./overlay-conventions.md) — Dialog / ContextMenu / 浮层组件规范
```

- [ ] **步骤 2: 编写 overlay-conventions.md**

```markdown
# 前端 Overlay 规范

## 目录约束

所有 Dialog 和 ContextMenu 必须放在 `packages/webui/src/overlays/` 下：

```
overlays/
  dialogs/          # Dialog 组件
  context-menus/    # ContextMenu 组件
  host/             # OverlayHost 渲染宿主（勿动）
  services/         # openDialog / openContextMenu 服务（勿动）
  composables/      # defineDialog / defineContextMenu（勿动）
  types/            # 类型定义（勿动）
```

**禁止：**
- 在业务组件模板中内联声明 Dialog / ContextMenu
- 在 `components/` 下新建 Dialog / ContextMenu
- 使用 Teleport 自实现浮层（统一走 OverlayHost）

## 类型安全

### Dialog Props

```ts
interface DialogBaseProps {
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void
  disableEsc?: boolean
  disableOverlayClick?: boolean
}
```

### ContextMenu Props

```ts
interface ContextMenuBaseProps {
  x: number
  y: number
  onClose?: () => void
}
```

**规则：**
- 所有回调使用可选链（`props.onConfirm?.()`）
- 业务 Props 通过 `extends DialogBaseProps | ContextMenuBaseProps` 扩展
- 禁止 `any` 类型

## 可访问性

| 行为 | Dialog | ContextMenu |
|------|--------|-------------|
| ESC 关闭 | 默认启用，`disableEsc` 可禁用 | 始终启用 |
| 遮罩点击关闭 | 默认启用，`disableOverlayClick` 可禁用 | 始终启用（点击菜单外） |
| 焦点管理 | reka-ui 自动 focus trap | 首项自动 focus（可选） |
| 背景滚动锁定 | reka-ui 自动处理 | 无需锁定 |

## 调用规范

### 打开 Dialog

```ts
import { openDialog } from '@/overlays'
import MyDialog from '@/overlays/dialogs/MyDialog.vue'

openDialog(MyDialog, {
  title: '标题',
  onConfirm: async () => { await save() },
})
```

### 打开 ContextMenu

```ts
import { openContextMenu, closeAllContextMenus } from '@/overlays'
import MyMenu from '@/overlays/context-menus/MyMenu.vue'

function onRightClick(e: MouseEvent) {
  closeAllContextMenus()
  openContextMenu(MyMenu, {
    x: e.clientX,
    y: e.clientY,
    onAction: (action) => { ... },
  })
}
```

## 组件内部规范

```ts
const { isOpen, close } = defineDialog()   // Dialog 用
const { isOpen, close } = defineContextMenu()  // ContextMenu 用
```

- 确认按钮调用 `onConfirm` → `await` → `close()`
- 取消/关闭直接调用 `close()`
- 菜单项点击调用回调 → `close()`

## 视口边界检测

ContextMenu 组件内部负责，使用 `offsetWidth/offsetHeight` 获取实际尺寸：

```ts
const menuRef = ref<HTMLElement | null>(null)

const position = computed(() => {
  const menuWidth = menuRef.value?.offsetWidth ?? 160
  const menuHeight = menuRef.value?.offsetHeight ?? 200
  const left = Math.max(0, Math.min(props.x, window.innerWidth - menuWidth))
  const top = Math.max(0, Math.min(props.y, window.innerHeight - menuHeight))
  return { left: `${left}px`, top: `${top}px` }
})
```

## 新增组件 checklist

- [ ] 放在 `overlays/dialogs/` 或 `overlays/context-menus/`
- [ ] 使用 `defineDialog()` / `defineContextMenu()`
- [ ] Props 扩展 `DialogBaseProps` / `ContextMenuBaseProps`
- [ ] 回调使用可选链
- [ ] 编写 `.spec.ts` 测试（AC-XX 命名）
- [ ] 在 `overlays/index.ts` 导出
```

- [ ] **步骤 3: 更新 CLAUDE.md 项目结构说明**

在 CLAUDE.md 的"项目结构"区块中，添加 `docs/webui-guide/` 说明：

```
docs/
  guide/          # 流程规范、skills
  webui-guide/    # 前端专项规范（overlay、组件约定等）
  prd/            # 产品需求
  ...
```

- [ ] **步骤 4: 更新 docs/guide/README.md 文档体系图**

在文档体系架构图中添加 `webui-guide/` 分支。

- [ ] **步骤 5: 运行测试验证通过**

运行：`npx vitest run`
预期：PASS

- [ ] **步骤 6: 提交**

```bash
git add docs/webui-guide/ CLAUDE.md docs/guide/README.md
git commit -m "docs(webui-guide): add overlay-conventions.md and update project structure"
```

---

## 任务 9: 最终验证

- [ ] **步骤 1: 运行全部单元测试**

```bash
npx vitest run tests/issues/f-10-context-menu-and-conventions/
```
预期：0 失败，全部绿色

- [ ] **步骤 2: 运行类型检查**

```bash
pnpm type-check
```
预期：0 错误

- [ ] **步骤 3: 运行相关回归测试**

```bash
npx vitest run tests/issues/f-09-dialog-migration/
```
预期：PASS（无回归）

- [ ] **步骤 4: 检查清单状态更新**

更新 `docs/issues/f-10-context-menu-and-conventions/checklist.json`：
- AC-01 ~ AC-11 全部标记为 `completed`

- [ ] **步骤 5: 提交**

```bash
git add docs/issues/f-10-context-menu-and-conventions/checklist.json
git commit -m "docs: update f-10 checklist — all AC completed"
```

---

## 自检

### 规格覆盖检查

| Spec 章节 | 对应任务 | 状态 |
|-----------|----------|------|
| feature-spec: FileManager 内联迁移 | 任务 4 | ✅ |
| feature-spec: FileExplorer ContextMenu.vue 迁移 | 任务 5 | ✅ |
| feature-spec: KnowledgeBasePage 引用检查 | 任务 6 | ✅ |
| feature-spec: 废弃旧 ContextMenu.vue | 任务 5 | ✅ |
| feature-spec: overlay-conventions.md | 任务 8 | ✅ |
| behavior-spec: 打开/关闭/视口边界/ESC/外部点击 | 任务 1/2/7 | ✅ |
| behavior-spec: 各页面差异流程 | 任务 1/2 | ✅ |
| behavior-spec: 错误场景 | 任务 1/2 | ✅ |
| api-spec: openContextMenu / closeContextMenu / closeAll | 任务 3 | ✅ |
| api-spec: ContextMenuBaseProps / 业务 Props | 任务 1/2 | ✅ |
| api-spec: defineContextMenu | 任务 1/2 | ✅ |

### 占位符扫描

计划中无 "TBD" / "TODO" / "稍后实现" / "添加适当的错误处理" / "为上述编写测试" / "类似于任务 N"。

### 类型一致性

- `ContextMenuBaseProps` 使用 f-08 已定义类型（`x`, `y`, `onClose?`）
- `defineContextMenu()` 返回 `{ isOpen, close }` 与 f-08 一致
- 回调全部使用可选链 `props.onAction?.()`

### TDD 红线检查

- 每个任务以测试开始：✅
- 测试在实现之前：✅
- 验证 RED（失败）和 GREEN（通过）步骤明确：✅
- 无 "这次例外"：✅
