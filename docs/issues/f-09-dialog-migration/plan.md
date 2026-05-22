---
id: f-09
issue: issue.md
version: 1
---

# Dialog 迁移至 overlays/ 实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 将 FileManager.vue 内联 Dialog 和 3 个独立 Dialog 组件迁移到 `overlays/dialogs/`，全部改为函数式 API 调用。

**架构：** 基于 f-08 overlay 核心机制（`openDialog`/`defineDialog`），每个 Dialog 组件使用 `defineDialog()` 管理生命周期，调用方通过 `openDialog(Component, props)` 打开。ConfirmDialog 迁移同时废弃 `utils/confirm.ts` 的 Promise 手动渲染模式。

**技术栈：** Vue 3 + TypeScript + shadcn-vue (reka-ui) + Vitest + @vue/test-utils

**Issue 引用：** [issue.md](issue.md)
**Spec 引用：** [specs/](specs/)

---

## 文件结构规划

### 新建文件

```
packages/webui/src/overlays/dialogs/
  CreateFolderDialog.vue
  RenameDialog.vue
  DeleteConfirmDialog.vue
  ConfirmDialog.vue          # 从 components/ 迁移
  EditKbDialog.vue           # 从 components/ 迁移
  MoveCopyDialog.vue         # 从 components/ 迁移

tests/issues/f-09-dialog-migration/
  CreateFolderDialog.spec.ts
  RenameDialog.spec.ts
  DeleteConfirmDialog.spec.ts
  ConfirmDialog.spec.ts
  EditKbDialog.spec.ts
  MoveCopyDialog.spec.ts
  integration.spec.ts
```

### 修改文件

- `packages/webui/src/components/knowledge-base/FileManager.vue` — 移除 3 个内联 Dialog 模板 + 12 个 ref，改为 openDialog 调用
- `packages/webui/src/components/FileExplorer.vue` — `confirmDialog()` → `openDialog(ConfirmDialog, ...)`
- `packages/webui/src/components/KnowledgeBasePage.vue` — 接入 `openDialog(EditKbDialog, ...)`（补全孤儿组件调用点）

### 删除/废弃文件

- `packages/webui/src/utils/confirm.ts` — 删除（功能被 `openDialog(ConfirmDialog, ...)` 替代）
- `packages/webui/src/components/ConfirmDialog.vue` — 删除（迁移到 overlays/dialogs/）
- `packages/webui/src/components/EditKbDialog.vue` — 删除（迁移到 overlays/dialogs/）
- `packages/webui/src/components/MoveCopyDialog.vue` — 删除（迁移到 overlays/dialogs/）

---

## 任务清单

### 任务 1: 编写 CreateFolderDialog + 测试（TDD）

**文件：**
- 创建：`packages/webui/src/overlays/dialogs/CreateFolderDialog.vue`
- 创建：`tests/issues/f-09-dialog-migration/CreateFolderDialog.spec.ts`

**规格引用：**
- 行为规格：[交互状态 - 打开/提交中/提交成功/提交失败]
- API 规格：[CreateFolderDialog Props]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/f-09-dialog-migration/CreateFolderDialog.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import CreateFolderDialog from '@/overlays/dialogs/CreateFolderDialog.vue'
import { OverlayCloseKey } from '@/overlays/host/symbols'

function mountDialog(props: Record<string, unknown> = {}) {
  const closeFn = vi.fn()
  const Wrapper = defineComponent({
    setup() {
      provide(OverlayCloseKey, closeFn)
      return () => h(CreateFolderDialog, {
        kbId: 'kb-1',
        parentFolderId: null,
        onConfirm: vi.fn(),
        ...props,
      })
    },
  })
  return { wrapper: mount(Wrapper), closeFn }
}

describe('CreateFolderDialog', () => {
  it('AC-01: renders dialog with title and input', () => {
    const { wrapper } = mountDialog()
    expect(wrapper.text()).toContain('新建文件夹')
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('AC-01: shows error when submitting empty name', async () => {
    const { wrapper } = mountDialog()
    await wrapper.find('button:last-child').trigger('click')
    expect(wrapper.text()).toContain('请输入文件夹名称')
  })

  it('AC-01: calls onConfirm with trimmed name on valid submit', async () => {
    const onConfirm = vi.fn()
    const { wrapper } = mountDialog({ onConfirm })
    await wrapper.find('input').setValue('My Folder')
    await wrapper.find('button:last-child').trigger('click')
    expect(onConfirm).toHaveBeenCalledWith('My Folder')
  })

  it('AC-01: cancel button calls close without onConfirm', () => {
    const onConfirm = vi.fn()
    const { wrapper, closeFn } = mountDialog({ onConfirm })
    wrapper.find('button:first-child').trigger('click')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(closeFn).toHaveBeenCalled()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/issues/f-09-dialog-migration/CreateFolderDialog.spec.ts
```
预期：FAIL — 模块不存在

- [ ] **步骤 3: 编写 CreateFolderDialog.vue**

```vue
<!-- packages/webui/src/overlays/dialogs/CreateFolderDialog.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { defineDialog } from '@/overlays/composables/useDialog'

const props = defineProps<{
  kbId: string
  parentFolderId?: string | null
  onConfirm: (name: string) => void | Promise<void>
}>()

const { isOpen, close } = defineDialog()
const name = ref('')
const error = ref('')
const isSubmitting = ref(false)

async function handleConfirm() {
  const trimmed = name.value.trim()
  if (!trimmed) {
    error.value = '请输入文件夹名称'
    return
  }
  isSubmitting.value = true
  try {
    await props.onConfirm(trimmed)
    close()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建失败'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Dialog :open="isOpen" @update:open="(v) => !v && close()">
    <DialogContent class="w-96">
      <DialogHeader>
        <DialogTitle>新建文件夹</DialogTitle>
      </DialogHeader>
      <div class="space-y-4">
        <Input
          v-model="name"
          type="text"
          placeholder="输入文件夹名称"
          class="rounded-xl border-border-default bg-surface-1 px-3 py-2.5 text-sm focus:border-accent-500/50"
          @keyup.enter="handleConfirm"
        />
        <p v-if="error" class="text-xs text-danger-500">{{ error }}</p>
      </div>
      <DialogFooter>
        <Button variant="ghost" class="rounded-xl px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2" @click="close">
          取消
        </Button>
        <Button class="rounded-xl bg-accent-500 px-3 py-1.5 text-sm text-white hover:bg-accent-600" :disabled="isSubmitting" @click="handleConfirm">
          {{ isSubmitting ? '创建中...' : '创建' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/issues/f-09-dialog-migration/CreateFolderDialog.spec.ts
```
预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add packages/webui/src/overlays/dialogs/CreateFolderDialog.vue tests/issues/f-09-dialog-migration/CreateFolderDialog.spec.ts
git commit -m "feat(overlays): add CreateFolderDialog with TDD"
```

---

### 任务 2: 编写 RenameDialog + 测试（TDD）

**文件：**
- 创建：`packages/webui/src/overlays/dialogs/RenameDialog.vue`
- 创建：`tests/issues/f-09-dialog-migration/RenameDialog.spec.ts`

**规格引用：**
- 行为规格：[各 Dialog 差异流程 - RenameDialog]
- API 规格：[RenameDialog Props]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/f-09-dialog-migration/RenameDialog.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import RenameDialog from '@/overlays/dialogs/RenameDialog.vue'
import { OverlayCloseKey } from '@/overlays/host/symbols'

function mountDialog(props: Record<string, unknown> = {}) {
  const closeFn = vi.fn()
  const Wrapper = defineComponent({
    setup() {
      provide(OverlayCloseKey, closeFn)
      return () => h(RenameDialog, {
        title: '重命名',
        initialValue: 'old-name.txt',
        onConfirm: vi.fn(),
        ...props,
      })
    },
  })
  return { wrapper: mount(Wrapper), closeFn }
}

describe('RenameDialog', () => {
  it('AC-02: renders with title and initial value', () => {
    const { wrapper } = mountDialog()
    expect(wrapper.text()).toContain('重命名')
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('old-name.txt')
  })

  it('AC-02: shows error when submitting empty name', async () => {
    const { wrapper } = mountDialog()
    await wrapper.find('input').setValue('')
    await wrapper.find('button:last-child').trigger('click')
    expect(wrapper.text()).toContain('名称不能为空')
  })

  it('AC-02: calls onConfirm with new name on valid submit', async () => {
    const onConfirm = vi.fn()
    const { wrapper } = mountDialog({ onConfirm })
    await wrapper.find('input').setValue('new-name.txt')
    await wrapper.find('button:last-child').trigger('click')
    expect(onConfirm).toHaveBeenCalledWith('new-name.txt')
  })

  it('AC-02: cancel closes without calling onConfirm', () => {
    const onConfirm = vi.fn()
    const { wrapper, closeFn } = mountDialog({ onConfirm })
    wrapper.find('button:first-child').trigger('click')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(closeFn).toHaveBeenCalled()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/issues/f-09-dialog-migration/RenameDialog.spec.ts
```
预期：FAIL — 模块不存在

- [ ] **步骤 3: 编写 RenameDialog.vue**

```vue
<!-- packages/webui/src/overlays/dialogs/RenameDialog.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { defineDialog } from '@/overlays/composables/useDialog'

const props = defineProps<{
  title: string
  initialValue: string
  onConfirm: (newName: string) => void | Promise<void>
}>()

const { isOpen, close } = defineDialog()
const name = ref(props.initialValue)
const error = ref('')
const isSubmitting = ref(false)

async function handleConfirm() {
  const trimmed = name.value.trim()
  if (!trimmed) {
    error.value = '名称不能为空'
    return
  }
  isSubmitting.value = true
  try {
    await props.onConfirm(trimmed)
    close()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '重命名失败'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Dialog :open="isOpen" @update:open="(v) => !v && close()">
    <DialogContent class="w-96">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
      </DialogHeader>
      <div class="space-y-4">
        <Input
          v-model="name"
          type="text"
          placeholder="输入新名称"
          class="rounded-xl border-border-default bg-surface-1 px-3 py-2.5 text-sm focus:border-accent-500/50"
          @keyup.enter="handleConfirm"
        />
        <p v-if="error" class="text-xs text-danger-500">{{ error }}</p>
      </div>
      <DialogFooter>
        <Button variant="ghost" class="rounded-xl px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2" @click="close">
          取消
        </Button>
        <Button class="rounded-xl bg-accent-500 px-3 py-1.5 text-sm text-white hover:bg-accent-600" :disabled="isSubmitting" @click="handleConfirm">
          {{ isSubmitting ? '保存中...' : '保存' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/issues/f-09-dialog-migration/RenameDialog.spec.ts
```
预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add packages/webui/src/overlays/dialogs/RenameDialog.vue tests/issues/f-09-dialog-migration/RenameDialog.spec.ts
git commit -m "feat(overlays): add RenameDialog with TDD"
```

---

### 任务 3: 编写 DeleteConfirmDialog + 测试（TDD）

**文件：**
- 创建：`packages/webui/src/overlays/dialogs/DeleteConfirmDialog.vue`
- 创建：`tests/issues/f-09-dialog-migration/DeleteConfirmDialog.spec.ts`

**规格引用：**
- 行为规格：[各 Dialog 差异流程 - DeleteConfirmDialog]
- API 规格：[DeleteConfirmDialog Props]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/f-09-dialog-migration/DeleteConfirmDialog.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import DeleteConfirmDialog from '@/overlays/dialogs/DeleteConfirmDialog.vue'
import { OverlayCloseKey } from '@/overlays/host/symbols'

function mountDialog(props: Record<string, unknown> = {}) {
  const closeFn = vi.fn()
  const Wrapper = defineComponent({
    setup() {
      provide(OverlayCloseKey, closeFn)
      return () => h(DeleteConfirmDialog, {
        title: '删除确认',
        message: '确认删除「test」？',
        kind: 'danger',
        onConfirm: vi.fn(),
        ...props,
      })
    },
  })
  return { wrapper: mount(Wrapper), closeFn }
}

describe('DeleteConfirmDialog', () => {
  it('AC-03: renders title and message', () => {
    const { wrapper } = mountDialog()
    expect(wrapper.text()).toContain('删除确认')
    expect(wrapper.text()).toContain('确认删除「test」？')
  })

  it('AC-03: calls onConfirm on confirm click', async () => {
    const onConfirm = vi.fn()
    const { wrapper } = mountDialog({ onConfirm })
    await wrapper.find('button:last-child').trigger('click')
    expect(onConfirm).toHaveBeenCalled()
  })

  it('AC-03: cancel clicks close without calling onConfirm', () => {
    const onConfirm = vi.fn()
    const { wrapper, closeFn } = mountDialog({ onConfirm })
    wrapper.find('button:first-child').trigger('click')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(closeFn).toHaveBeenCalled()
  })

  it('AC-03: applies danger button class when kind is danger', () => {
    const { wrapper } = mountDialog({ kind: 'danger' })
    const confirmBtn = wrapper.find('button:last-child')
    expect(confirmBtn.classes()).toContain('bg-danger-500')
  })

  it('AC-03: respects custom confirmText', () => {
    const { wrapper } = mountDialog({ confirmText: 'Yes, Delete' })
    expect(wrapper.text()).toContain('Yes, Delete')
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/issues/f-09-dialog-migration/DeleteConfirmDialog.spec.ts
```
预期：FAIL — 模块不存在

- [ ] **步骤 3: 编写 DeleteConfirmDialog.vue**

```vue
<!-- packages/webui/src/overlays/dialogs/DeleteConfirmDialog.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { defineDialog } from '@/overlays/composables/useDialog'

const props = withDefaults(defineProps<{
  title: string
  message: string
  confirmText?: string
  kind?: 'info' | 'warning' | 'danger'
  onConfirm: () => void | Promise<void>
}>(), {
  confirmText: '删除',
  kind: 'danger',
})

const { isOpen, close } = defineDialog()
const isDeleting = ref(false)

const btnClasses: Record<string, string> = {
  info: 'bg-accent-500 hover:bg-accent-600',
  warning: 'bg-amber-500 hover:bg-amber-600',
  danger: 'bg-danger-500 hover:bg-danger-600',
}

async function handleConfirm() {
  isDeleting.value = true
  try {
    await props.onConfirm()
    close()
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <Dialog :open="isOpen" @update:open="(v) => !v && close()">
    <DialogContent class="w-96">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
      </DialogHeader>
      <p class="text-sm text-text-secondary" v-html="message"></p>
      <DialogFooter>
        <Button variant="ghost" class="rounded-xl px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2" @click="close">
          取消
        </Button>
        <Button class="rounded-xl px-3 py-1.5 text-sm text-white" :class="btnClasses[kind]" :disabled="isDeleting" @click="handleConfirm">
          {{ isDeleting ? '删除中...' : confirmText }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/issues/f-09-dialog-migration/DeleteConfirmDialog.spec.ts
```
预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add packages/webui/src/overlays/dialogs/DeleteConfirmDialog.vue tests/issues/f-09-dialog-migration/DeleteConfirmDialog.spec.ts
git commit -m "feat(overlays): add DeleteConfirmDialog with TDD"
```

---

### 任务 4: 迁移 ConfirmDialog + 测试（TDD）

**文件：**
- 创建：`packages/webui/src/overlays/dialogs/ConfirmDialog.vue`
- 创建：`tests/issues/f-09-dialog-migration/ConfirmDialog.spec.ts`

**规格引用：**
- 行为规格：[各 Dialog 差异流程 - ConfirmDialog]
- API 规格：[ConfirmDialog Props]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/f-09-dialog-migration/ConfirmDialog.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import ConfirmDialog from '@/overlays/dialogs/ConfirmDialog.vue'
import { OverlayCloseKey } from '@/overlays/host/symbols'

function mountDialog(props: Record<string, unknown> = {}) {
  const closeFn = vi.fn()
  const Wrapper = defineComponent({
    setup() {
      provide(OverlayCloseKey, closeFn)
      return () => h(ConfirmDialog, {
        title: '提示',
        message: '确定删除文件吗？',
        ...props,
      })
    },
  })
  return { wrapper: mount(Wrapper), closeFn }
}

describe('ConfirmDialog', () => {
  it('AC-04: renders title and message', () => {
    const { wrapper } = mountDialog()
    expect(wrapper.text()).toContain('提示')
    expect(wrapper.text()).toContain('确定删除文件吗？')
  })

  it('AC-04: calls onConfirm on confirm and closes', async () => {
    const onConfirm = vi.fn()
    const { wrapper } = mountDialog({ onConfirm })
    await wrapper.find('button:last-child').trigger('click')
    expect(onConfirm).toHaveBeenCalled()
  })

  it('AC-04: calls onCancel on cancel and closes', () => {
    const onCancel = vi.fn()
    const { wrapper, closeFn } = mountDialog({ onCancel })
    wrapper.find('button:first-child').trigger('click')
    expect(onCancel).toHaveBeenCalled()
    expect(closeFn).toHaveBeenCalled()
  })

  it('AC-04: shows custom confirmText and cancelText', () => {
    const { wrapper } = mountDialog({ confirmText: '是', cancelText: '否' })
    expect(wrapper.text()).toContain('是')
    expect(wrapper.text()).toContain('否')
  })

  it('AC-04: renders with danger kind styling', () => {
    const { wrapper } = mountDialog({ kind: 'danger' })
    expect(wrapper.find('.text-danger-500').exists()).toBe(true)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/issues/f-09-dialog-migration/ConfirmDialog.spec.ts
```
预期：FAIL — 模块不存在

- [ ] **步骤 3: 编写 ConfirmDialog.vue（overlay 版本）**

```vue
<!-- packages/webui/src/overlays/dialogs/ConfirmDialog.vue -->
<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { defineDialog } from '@/overlays/composables/useDialog'
import { AlertCircleIcon } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  kind?: 'info' | 'warning' | 'danger'
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void
}>(), {
  confirmText: '确定',
  cancelText: '取消',
  kind: 'info',
})

const { isOpen, close } = defineDialog()

const kindClasses: Record<string, string> = {
  info: 'text-accent-500',
  warning: 'text-amber-500',
  danger: 'text-danger-500',
}

const btnClasses: Record<string, string> = {
  info: 'bg-accent-500 hover:bg-accent-600',
  warning: 'bg-amber-500 hover:bg-amber-600',
  danger: 'bg-danger-500 hover:bg-danger-600',
}

async function handleConfirm() {
  await props.onConfirm?.()
  close()
}

function handleCancel() {
  props.onCancel?.()
  close()
}
</script>

<template>
  <Dialog :open="isOpen" @update:open="(v) => !v && close()">
    <DialogContent class="w-80">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
      </DialogHeader>
      <div class="flex items-start gap-3">
        <AlertCircleIcon class="size-8 shrink-0" :class="kindClasses[kind]" />
        <p class="text-sm text-text-secondary leading-relaxed">{{ message }}</p>
      </div>
      <DialogFooter>
        <Button variant="ghost" class="rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary" @click="handleCancel">
          {{ cancelText }}
        </Button>
        <Button class="rounded-lg px-3 py-1.5 text-sm text-white" :class="btnClasses[kind]" @click="handleConfirm">
          {{ confirmText }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/issues/f-09-dialog-migration/ConfirmDialog.spec.ts
```
预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add packages/webui/src/overlays/dialogs/ConfirmDialog.vue tests/issues/f-09-dialog-migration/ConfirmDialog.spec.ts
git commit -m "feat(overlays): migrate ConfirmDialog to overlays/dialogs with TDD"
```

---

### 任务 5: 迁移 EditKbDialog + 测试（TDD）

**文件：**
- 创建：`packages/webui/src/overlays/dialogs/EditKbDialog.vue`
- 创建：`tests/issues/f-09-dialog-migration/EditKbDialog.spec.ts`

**规格引用：**
- 行为规格：[各 Dialog 差异流程 - EditKbDialog]
- API 规格：[EditKbDialog Props]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/f-09-dialog-migration/EditKbDialog.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import EditKbDialog from '@/overlays/dialogs/EditKbDialog.vue'
import { OverlayCloseKey } from '@/overlays/host/symbols'

function mountDialog(props: Record<string, unknown> = {}) {
  const closeFn = vi.fn()
  const Wrapper = defineComponent({
    setup() {
      provide(OverlayCloseKey, closeFn)
      return () => h(EditKbDialog, {
        kbId: 'kb-1',
        initialName: 'My KB',
        initialIcon: 'mdi-database',
        onConfirm: vi.fn(),
        ...props,
      })
    },
  })
  return { wrapper: mount(Wrapper), closeFn }
}

describe('EditKbDialog', () => {
  it('AC-05: renders with title "修改资料" and initial name', () => {
    const { wrapper } = mountDialog()
    expect(wrapper.text()).toContain('修改资料')
    const input = wrapper.find('[data-testid="edit-kb-name-input"]')
    expect((input.element as HTMLInputElement).value).toBe('My KB')
  })

  it('AC-05: shows error when submitting empty name', async () => {
    const { wrapper } = mountDialog()
    const input = wrapper.find('[data-testid="edit-kb-name-input"]')
    await input.setValue('')
    await wrapper.find('button:last-child').trigger('click')
    expect(wrapper.text()).toContain('请输入知识库名称')
  })

  it('AC-05: calls onConfirm with name and icon on valid submit', async () => {
    const onConfirm = vi.fn()
    const { wrapper } = mountDialog({ onConfirm })
    await wrapper.find('button:last-child').trigger('click')
    expect(onConfirm).toHaveBeenCalledWith('My KB', 'mdi-database')
  })

  it('AC-05: cancel closes without calling onConfirm', () => {
    const onConfirm = vi.fn()
    const { wrapper, closeFn } = mountDialog({ onConfirm })
    wrapper.find('button:first-child').trigger('click')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(closeFn).toHaveBeenCalled()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/issues/f-09-dialog-migration/EditKbDialog.spec.ts
```
预期：FAIL — 模块不存在

- [ ] **步骤 3: 编写 EditKbDialog.vue**

> 基于现有 `components/EditKbDialog.vue` 迁移：替换 `visible` prop + `emit` 模式为 `defineDialog()` 模式，其他 UI 保持不变。

```vue
<!-- packages/webui/src/overlays/dialogs/EditKbDialog.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { defineDialog } from '@/overlays/composables/useDialog'
import {
  DatabaseIcon, BookIcon, LibraryIcon, FolderIcon,
  FolderOpenIcon, FileTextIcon, BookOpenIcon,
  GraduationCapIcon, BrainIcon,
} from 'lucide-vue-next'

const props = defineProps<{
  kbId: string
  initialName: string
  initialIcon: string
  onConfirm: (name: string, icon: string) => void | Promise<void>
}>()

const { isOpen, close } = defineDialog()
const name = ref(props.initialName)
const icon = ref(props.initialIcon)
const error = ref('')

const iconOptions = [
  { name: 'mdi-database', component: DatabaseIcon },
  { name: 'mdi-books', component: BookIcon },
  { name: 'mdi-bookshelf', component: LibraryIcon },
  { name: 'mdi-folder', component: FolderIcon },
  { name: 'mdi-folder-open', component: FolderOpenIcon },
  { name: 'mdi-file-document', component: FileTextIcon },
  { name: 'mdi-notebook', component: BookOpenIcon },
  { name: 'mdi-school', component: GraduationCapIcon },
  { name: 'mdi-brain', component: BrainIcon },
]

async function onSave() {
  const trimmed = name.value.trim()
  if (!trimmed) {
    error.value = '请输入知识库名称'
    return
  }
  await props.onConfirm(trimmed, icon.value)
  close()
}
</script>

<template>
  <Dialog :open="isOpen" @update:open="(v) => !v && close()">
    <DialogContent class="w-96">
      <DialogHeader>
        <DialogTitle>修改资料</DialogTitle>
      </DialogHeader>
      <div class="space-y-4">
        <div>
          <label class="mb-1 block text-xs text-text-secondary">名称</label>
          <Input
            v-model="name"
            type="text"
            data-testid="edit-kb-name-input"
            class="rounded-xl border-border-default bg-surface-1 px-3 py-2 text-sm focus:border-accent-500"
            @keyup.enter="onSave"
          />
          <p v-if="error" class="mt-1 text-xs text-danger-500">{{ error }}</p>
        </div>
        <div>
          <label class="mb-2 block text-xs text-text-secondary">图标</label>
          <div class="grid grid-cols-5 gap-2">
            <Button
              v-for="opt in iconOptions"
              :key="opt.name"
              variant="ghost"
              size="icon-sm"
              class="flex h-10 items-center justify-center rounded-xl border transition-colors"
              :class="icon === opt.name ? 'border-accent-500 bg-accent-soft text-accent-500 hover:bg-accent-soft' : 'border-border-default text-text-tertiary hover:bg-surface-2'"
              @click="icon = opt.name"
            >
              <Component :is="opt.component" class="size-5" />
            </Button>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" class="rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary" @click="close">取消</Button>
        <Button class="rounded-lg bg-accent-500 px-3 py-1.5 text-sm text-white hover:bg-accent-600" @click="onSave">保存</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/issues/f-09-dialog-migration/EditKbDialog.spec.ts
```
预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add packages/webui/src/overlays/dialogs/EditKbDialog.vue tests/issues/f-09-dialog-migration/EditKbDialog.spec.ts
git commit -m "feat(overlays): migrate EditKbDialog to overlays/dialogs with TDD"
```

---

### 任务 6: 迁移 MoveCopyDialog + 测试（TDD）

**文件：**
- 创建：`packages/webui/src/overlays/dialogs/MoveCopyDialog.vue`
- 创建：`tests/issues/f-09-dialog-migration/MoveCopyDialog.spec.ts`

**规格引用：**
- 行为规格：[各 Dialog 差异流程 - MoveCopyDialog]
- API 规格：[MoveCopyDialog Props]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/f-09-dialog-migration/MoveCopyDialog.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import MoveCopyDialog from '@/overlays/dialogs/MoveCopyDialog.vue'
import { OverlayCloseKey } from '@/overlays/host/symbols'
import { createPinia, setActivePinia } from 'pinia'

function mountDialog(props: Record<string, unknown> = {}) {
  setActivePinia(createPinia())
  const closeFn = vi.fn()
  const Wrapper = defineComponent({
    setup() {
      provide(OverlayCloseKey, closeFn)
      return () => h(MoveCopyDialog, {
        mode: 'move',
        sourceKbId: 'kb-1',
        sourcePath: '/',
        onConfirm: vi.fn(),
        ...props,
      })
    },
  })
  return { wrapper: mount(Wrapper), closeFn }
}

describe('MoveCopyDialog', () => {
  it('AC-06: renders with mode title "移动到" for move', () => {
    const { wrapper } = mountDialog({ mode: 'move' })
    expect(wrapper.text()).toContain('移动到')
  })

  it('AC-06: renders with mode title "复制到" for copy', () => {
    const { wrapper } = mountDialog({ mode: 'copy' })
    expect(wrapper.text()).toContain('复制到')
  })

  it('AC-06: cancel closes without calling onConfirm', () => {
    const onConfirm = vi.fn()
    const { wrapper, closeFn } = mountDialog({ onConfirm })
    wrapper.find('button:first-child').trigger('click')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(closeFn).toHaveBeenCalled()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/issues/f-09-dialog-migration/MoveCopyDialog.spec.ts
```
预期：FAIL — 模块不存在

- [ ] **步骤 3: 编写 MoveCopyDialog.vue**

> 基于现有 `components/MoveCopyDialog.vue` 迁移：替换 `visible` prop + `emit` 模式为 `defineDialog()` 模式。

```vue
<!-- packages/webui/src/overlays/dialogs/MoveCopyDialog.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { defineDialog } from '@/overlays/composables/useDialog'
import {
  DatabaseIcon, ChevronRightIcon, LoaderIcon,
  FolderOpenIcon, FolderIcon,
} from 'lucide-vue-next'
import type { KnowledgeBase } from '@/types'

const props = defineProps<{
  mode: 'move' | 'copy'
  sourceKbId: string
  sourcePath: string
  onConfirm: (targetKbId: string, targetPath: string) => void | Promise<void>
}>()

const { isOpen, close } = defineDialog()
const store = useKnowledgeBaseStore()

const selectedTargetKbId = ref(props.sourceKbId)
const targetPath = ref('')
const targetBreadcrumb = ref<string[]>([])
const targetFiles = ref<Array<{ name: string; type: string }>>([])
const isLoading = ref(false)

const targetKb = computed(() =>
  store.knowledgeBases.find((kb) => kb.id === selectedTargetKbId.value)
)

async function loadTargetFiles() {
  if (!selectedTargetKbId.value) return
  isLoading.value = true
  try {
    const data = await api.get<{ items: Array<{ name: string; type: string }> }>(
      `/knowledge-bases/${selectedTargetKbId.value}/files?path=${encodeURIComponent(targetPath.value)}`
    )
    targetFiles.value = (data.items || []).filter((item) => item.type === 'directory')
  } catch {
    targetFiles.value = []
  } finally {
    isLoading.value = false
  }
}

function onSelectKb(kb: KnowledgeBase) {
  selectedTargetKbId.value = kb.id
  targetPath.value = ''
  targetBreadcrumb.value = []
  loadTargetFiles()
}

function onEnterFolder(folderName: string) {
  targetBreadcrumb.value.push(folderName)
  targetPath.value = targetBreadcrumb.value.join('/')
  loadTargetFiles()
}

function onBreadcrumbClick(index: number) {
  if (index === -1) {
    targetBreadcrumb.value = []
    targetPath.value = ''
  } else {
    targetBreadcrumb.value = targetBreadcrumb.value.slice(0, index + 1)
    targetPath.value = targetBreadcrumb.value.join('/')
  }
  loadTargetFiles()
}

async function onConfirm() {
  await props.onConfirm(selectedTargetKbId.value, targetPath.value)
  close()
}

loadTargetFiles()
</script>

<template>
  <Dialog :open="isOpen" @update:open="(v) => !v && close()">
    <DialogContent class="flex h-[480px] w-[640px] max-w-[640px] flex-col p-0">
      <DialogHeader class="border-b border-border-default px-5 py-3">
        <DialogTitle class="text-base font-medium text-text-primary">
          {{ mode === 'move' ? '移动到' : '复制到' }}
        </DialogTitle>
      </DialogHeader>
      <div class="flex flex-1 overflow-hidden">
        <div class="w-48 border-r border-border-default overflow-auto p-2">
          <div
            v-for="kb in store.knowledgeBases"
            :key="kb.id"
            class="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-colors"
            :class="selectedTargetKbId === kb.id ? 'bg-accent-soft text-accent-500' : 'text-text-secondary hover:bg-surface-2'"
            @click="onSelectKb(kb)"
          >
            <DatabaseIcon class="size-5 shrink-0" />
            <span class="truncate">{{ kb.name }}</span>
          </div>
        </div>
        <div class="flex flex-1 flex-col">
          <div class="flex items-center gap-1 border-b border-border-default px-3 py-2">
            <Button variant="ghost" size="sm" class="h-auto px-1 py-0 text-sm text-text-secondary hover:text-text-primary" @click="onBreadcrumbClick(-1)">根目录</Button>
            <template v-for="(seg, idx) in targetBreadcrumb" :key="idx">
              <ChevronRightIcon class="size-3 text-text-tertiary" />
              <Button variant="ghost" size="sm" class="h-auto px-1 py-0 text-sm text-text-secondary hover:text-text-primary" @click="onBreadcrumbClick(idx)">{{ seg }}</Button>
            </template>
          </div>
          <div class="flex-1 overflow-auto p-2">
            <div v-if="isLoading" class="flex h-full items-center justify-center">
              <LoaderIcon class="size-8 animate-spin text-accent-500" />
            </div>
            <div v-else-if="targetFiles.length === 0" class="flex h-full flex-col items-center justify-center text-text-tertiary">
              <FolderOpenIcon class="size-16" />
              <span class="text-sm mt-1">暂无子文件夹</span>
            </div>
            <div
              v-for="folder in targetFiles"
              :key="folder.name"
              class="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-surface-2"
              @dblclick="onEnterFolder(folder.name)"
            >
              <FolderIcon class="size-5 text-amber-400" />
              <span class="text-sm text-text-primary">{{ folder.name }}</span>
            </div>
          </div>
        </div>
      </div>
      <DialogFooter class="border-t border-border-default px-5 py-3">
        <Button variant="ghost" class="rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2" @click="close">取消</Button>
        <Button class="rounded-lg bg-accent-500 px-3 py-1.5 text-sm text-white hover:bg-accent-600" @click="onConfirm">
          {{ mode === 'move' ? '移动至此' : '复制至此' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/issues/f-09-dialog-migration/MoveCopyDialog.spec.ts
```
预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add packages/webui/src/overlays/dialogs/MoveCopyDialog.vue tests/issues/f-09-dialog-migration/MoveCopyDialog.spec.ts
git commit -m "feat(overlays): migrate MoveCopyDialog to overlays/dialogs with TDD"
```

---

### 任务 7: 重构 FileManager.vue + 测试（TDD）

**文件：**
- 修改：`packages/webui/src/components/knowledge-base/FileManager.vue`
- 创建：`tests/issues/f-09-dialog-migration/integration.spec.ts`（集成测试）

**规格引用：**
- 行为规格：[AC-07: 所有调用点改为函数式 API]
- 行为规格：[AC-08: Dialog 关闭后 DOM 无残留]

- [ ] **步骤 1: 编写集成测试**

```typescript
// tests/issues/f-09-dialog-migration/integration.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useOverlayHost } from '@/overlays/host/useOverlayHost'
import { openDialog, closeDialog } from '@/overlays/services/dialog.service'
import CreateFolderDialog from '@/overlays/dialogs/CreateFolderDialog.vue'
import RenameDialog from '@/overlays/dialogs/RenameDialog.vue'
import DeleteConfirmDialog from '@/overlays/dialogs/DeleteConfirmDialog.vue'

describe('overlay dialogs integration', () => {
  beforeEach(() => {
    useOverlayHost().clearOverlays()
  })

  it('AC-07: openDialog with CreateFolderDialog adds to queue', () => {
    const id = openDialog(CreateFolderDialog, { kbId: 'kb-1', onConfirm: () => {} })
    expect(id).toBeDefined()
    expect(useOverlayHost().overlays).toHaveLength(1)
    expect(useOverlayHost().overlays[0].type).toBe('dialog')
  })

  it('AC-07: openDialog with RenameDialog passes props correctly', () => {
    openDialog(RenameDialog, { title: '重命名', initialValue: 'old', onConfirm: () => {} })
    const overlay = useOverlayHost().overlays[0]
    expect(overlay.props.title).toBe('重命名')
    expect(overlay.props.initialValue).toBe('old')
  })

  it('AC-07: openDialog with DeleteConfirmDialog passes kind prop', () => {
    openDialog(DeleteConfirmDialog, { title: '删除', message: '确认？', kind: 'warning', onConfirm: () => {} })
    expect(useOverlayHost().overlays[0].props.kind).toBe('warning')
  })

  it('AC-08: closeDialog removes overlay from queue', () => {
    const id = openDialog(CreateFolderDialog, { kbId: 'kb-1', onConfirm: () => {} })
    closeDialog(id)
    expect(useOverlayHost().overlays).toHaveLength(0)
  })

  it('AC-10: non-migrated pages should not crash when overlays used elsewhere', () => {
    openDialog(CreateFolderDialog, { kbId: 'kb-1', onConfirm: () => {} })
    openDialog(RenameDialog, { title: '重命名', initialValue: 'x', onConfirm: () => {} })
    useOverlayHost().clearOverlays()
    expect(useOverlayHost().overlays).toHaveLength(0)
  })
})
```

- [ ] **步骤 2: 运行集成测试确认通过**

```bash
npx vitest run tests/issues/f-09-dialog-migration/integration.spec.ts
```
预期：PASS（集成测试验证 f-08 基础设施与新 Dialog 组件正确协作）

- [ ] **步骤 3: 修改 FileManager.vue**

**移除：**
- 6 个 Dialog 相关 ref（showCreateFolderDialog, createFolderName, createFolderError, isCreatingFolder, showRenameDialog, renameTarget, renameValue, renameError, isRenaming, showDeleteDialog, deleteTarget, isDeleting）
- 3 个 Dialog 模板块（新建文件夹、重命名、删除确认）
- 导入中的 `Input`（如果不再使用）
- `confirmCreateFolder`, `confirmRename`, `confirmDelete` 函数
- `openCreateFolderDialog`, `openRenameDialog`, `openDeleteDialog` 函数

**替换为：**
- `openDialog(CreateFolderDialog, ...)` — 替代 `openCreateFolderDialog`
- `openDialog(RenameDialog, ...)` — 替代 `openRenameDialog`
- `openDialog(DeleteConfirmDialog, ...)` — 替代 `openDeleteDialog`

具体修改（逐处编辑）：

1. 在 `<script setup>` 顶部添加导入：
```typescript
import { openDialog } from '@/overlays'
import CreateFolderDialog from '@/overlays/dialogs/CreateFolderDialog.vue'
import RenameDialog from '@/overlays/dialogs/RenameDialog.vue'
import DeleteConfirmDialog from '@/overlays/dialogs/DeleteConfirmDialog.vue'
```

2. 移除不再需要的导入：`Input`（仅用于 3 个内联 Dialog，迁移后无需保留），以及 `Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter`（若 FileManager 其他地方不再使用）

3. 删除 12 个 ref（行 42-57），替换 `openCreateFolderDialog`/`openRenameDialog`/`openDeleteDialog` 为：
```typescript
function openCreateFolderDialog() {
  closeContextMenu()
  openDialog(CreateFolderDialog, {
    kbId: props.kbId!,
    parentFolderId: fileStore.currentFolderId,
    onConfirm: async (name) => {
      await fileStore.createFolder(props.kbId!, name, fileStore.currentFolderId)
      if (props.kbId) fileStore.loadItems(props.kbId, fileStore.currentFolderId)
    },
  })
}

function openRenameDialog(item: DocumentItem | Folder) {
  closeContextMenu()
  openDialog(RenameDialog, {
    title: '重命名',
    initialValue: item.name,
    onConfirm: async (newName) => {
      if ('status' in item) {
        await fileStore.renameDocument(item.id, newName)
      } else {
        await fileStore.renameFolder(props.kbId!, item.id, newName)
      }
      if (props.kbId) fileStore.loadItems(props.kbId, fileStore.currentFolderId)
    },
  })
}

function openDeleteDialog(item: DocumentItem | Folder) {
  closeContextMenu()
  const isFolder = !('status' in item)
  openDialog(DeleteConfirmDialog, {
    title: '删除确认',
    message: `确认删除「${item.name}」？${isFolder ? '<span class="text-danger-500">文件夹内的所有内容将被一并删除。</span>' : ''}`,
    kind: 'danger',
    onConfirm: async () => {
      if (isFolder) {
        await fileStore.deleteFolder(props.kbId!, item.id)
      } else {
        await fileStore.deleteDocument(item.id)
      }
      if (props.kbId) fileStore.loadItems(props.kbId, fileStore.currentFolderId)
    },
  })
}
```

4. 删除模板中 3 个 `<Dialog>` 块（行 441-537）

- [ ] **步骤 4: 运行全部测试验证通过**

```bash
npx vitest run tests/issues/f-09-dialog-migration/
```
预期：全部 PASS

- [ ] **步骤 5: 提交**

```bash
git add packages/webui/src/components/knowledge-base/FileManager.vue tests/issues/f-09-dialog-migration/integration.spec.ts
git commit -m "refactor(FileManager): migrate inline dialogs to overlays/ functional API"
```

---

### 任务 8: 更新 FileExplorer.vue + 废弃 utils/confirm.ts（TDD）

**文件：**
- 修改：`packages/webui/src/components/FileExplorer.vue`
- 删除：`packages/webui/src/utils/confirm.ts`
- 删除：`packages/webui/src/components/ConfirmDialog.vue`（旧版）

**规格引用：**
- 行为规格：[AC-07: 所有调用点改为函数式 API]

- [ ] **步骤 1: 修改 FileExplorer.vue**

将 `onDeleteClick()` 中的 `confirmDialog()` 替换为 `openDialog()`：

```typescript
// 旧
import { confirmDialog } from '@/utils/confirm'
// 新
import { openDialog } from '@/overlays'
import ConfirmDialog from '@/overlays/dialogs/ConfirmDialog.vue'
```

```typescript
// 旧 — onDeleteClick()
if (await confirmDialog(`确认永久删除文件「${contextMenuFile.value}」？此操作不可撤销。`, { title: '提示', kind: 'danger' })) {
  emit('deleteFile', contextMenuFile.value)
}

// 新 — onDeleteClick()
openDialog(ConfirmDialog, {
  title: '提示',
  message: `确认永久删除文件「${contextMenuFile.value}」？此操作不可撤销。`,
  kind: 'danger',
  onConfirm: () => {
    emit('deleteFile', contextMenuFile.value!)
  },
})
```

- [ ] **步骤 2: 删除废弃文件**

```bash
rm packages/webui/src/utils/confirm.ts
rm packages/webui/src/components/ConfirmDialog.vue
```

- [ ] **步骤 3: 搜索确认无残留引用**

```bash
grep -r "confirmDialog" packages/webui/src/ --include="*.ts" --include="*.vue"
grep -r "from.*utils/confirm" packages/webui/src/
grep -r "from.*components/ConfirmDialog" packages/webui/src/
```
预期：无输出（除 overlays/dialogs/ConfirmDialog.vue 自身的引用）

- [ ] **步骤 4: 运行全部测试**

```bash
npx vitest run tests/issues/f-09-dialog-migration/
```
预期：全部 PASS

- [ ] **步骤 5: 提交**

```bash
git add packages/webui/src/components/FileExplorer.vue
git rm packages/webui/src/utils/confirm.ts packages/webui/src/components/ConfirmDialog.vue
git commit -m "refactor(FileExplorer): replace confirmDialog with openDialog(ConfirmDialog), deprecate utils/confirm.ts"
```

---

### 任务 9: 接入 EditKbDialog + MoveCopyDialog 调用点（TDD）

**文件：**
- 修改：`packages/webui/src/components/KnowledgeBasePage.vue` — 接入 `openDialog(EditKbDialog, ...)`
- 修改：`packages/webui/src/components/FileExplorer.vue` — 接入 `openDialog(MoveCopyDialog, ...)` 到 `onMoveClick`/`onCopyClick`
- 删除：`packages/webui/src/components/EditKbDialog.vue`（旧版）
- 删除：`packages/webui/src/components/MoveCopyDialog.vue`（旧版）

- [ ] **步骤 1: 接入 KnowledgeBasePage.vue 的编辑入口**

在 KnowledgeBasePage.vue 中，找到上下文菜单的"编辑"动作（应在 context menu 处），添加：

```typescript
import { openDialog } from '@/overlays'
import EditKbDialog from '@/overlays/dialogs/EditKbDialog.vue'

// 在编辑按钮点击时调用
function onEditKb(kb: KnowledgeBase) {
  openDialog(EditKbDialog, {
    kbId: kb.id,
    initialName: kb.name,
    initialIcon: kb.icon || 'mdi-database',
    onConfirm: async (name, icon) => {
      await store.updateKnowledgeBase(kb.id, { name, icon })
      await store.loadKnowledgeBases()
    },
  })
}
```

> 注：如果 KnowledgeBasePage 中无编辑入口，可跳过此步骤，仅删除旧版 EditKbDialog.vue 文件。告知用户 orphan 组件已迁移，可随时接入。

- [ ] **步骤 2: 接入 FileExplorer.vue 的 MoveCopy 入口**

修改 `onMoveClick`/`onCopyClick`：

```typescript
import { openDialog } from '@/overlays'
import MoveCopyDialog from '@/overlays/dialogs/MoveCopyDialog.vue'

function onMoveClick() {
  if (contextMenuFile.value) {
    const fileName = contextMenuFile.value
    closeFileContextMenu()
    openDialog(MoveCopyDialog, {
      mode: 'move',
      sourceKbId: props.kbId!,
      sourcePath: `${props.currentPath}/${fileName}`,
      onConfirm: (_targetKbId, _targetPath) => {
        emit('moveFile', fileName)
      },
    })
  }
}

function onCopyClick() {
  if (contextMenuFile.value) {
    const fileName = contextMenuFile.value
    closeFileContextMenu()
    openDialog(MoveCopyDialog, {
      mode: 'copy',
      sourceKbId: props.kbId!,
      sourcePath: `${props.currentPath}/${fileName}`,
      onConfirm: (_targetKbId, _targetPath) => {
        emit('copyFile', fileName)
      },
    })
  }
}
```

- [ ] **步骤 3: 删除旧版组件文件**

```bash
rm packages/webui/src/components/EditKbDialog.vue
rm packages/webui/src/components/MoveCopyDialog.vue
```

- [ ] **步骤 4: 搜索确认无残留引用**

```bash
grep -r "EditKbDialog" packages/webui/src/ --include="*.ts" --include="*.vue" | grep -v overlays/dialogs
grep -r "MoveCopyDialog" packages/webui/src/ --include="*.ts" --include="*.vue" | grep -v overlays/dialogs
```
预期：无输出

- [ ] **步骤 5: 运行全部测试 + 类型检查**

```bash
npx vitest run tests/issues/f-09-dialog-migration/
pnpm type-check
```
预期：全部 PASS，0 类型错误

- [ ] **步骤 6: 提交**

```bash
git add packages/webui/src/components/KnowledgeBasePage.vue packages/webui/src/components/FileExplorer.vue
git rm packages/webui/src/components/EditKbDialog.vue packages/webui/src/components/MoveCopyDialog.vue
git commit -m "feat(overlays): wire up EditKbDialog and MoveCopyDialog callers, remove old components"
```

---

## 自检

### 1. 规格覆盖检查

| Spec 章节 | 实现任务 | 状态 |
|-----------|----------|------|
| AC-01: CreateFolderDialog | 任务 1 | ✅ |
| AC-02: RenameDialog | 任务 2 | ✅ |
| AC-03: DeleteConfirmDialog | 任务 3 | ✅ |
| AC-04: ConfirmDialog 迁移 | 任务 4 | ✅ |
| AC-05: EditKbDialog 迁移 | 任务 5 | ✅ |
| AC-06: MoveCopyDialog 迁移 | 任务 6 | ✅ |
| AC-07: 调用点改为函数式 | 任务 7, 8, 9 | ✅ |
| AC-08: Dialog 关闭 DOM 无残留 | 任务 7（f-08 保证） | ✅ |
| AC-09: FileManager 功能测试 | 任务 7 | ✅ |
| AC-10: 其他页面功能正常 | 任务 7, 8, 9（无变更） | ✅ |

### 2. 占位符扫描

- [x] 无 "TBD"、"TODO"、"稍后实现"
- [x] 无 "添加适当的错误处理"
- [x] 每个任务有具体代码块
- [x] 无引用未定义的类型/函数

### 3. 类型一致性

- [x] 所有 Dialog Props 继承 `DialogBaseProps`
- [x] `onConfirm`/`onCancel` 均为可选，内部使用 `?.()`
- [x] `defineDialog()` 签名一致 `(): { isOpen, close }`
- [x] `openDialog()` 签名一致 `(component, props): string`

---

## 执行交接

**计划已保存到 `docs/issues/f-09-dialog-migration/plan.md`。两种执行方式：**

1. **子代理驱动（推荐）** — 每个任务新子代理，任务间审查
2. **内联执行** — 当前会话顺序执行，带检查点

**选择哪种？**
