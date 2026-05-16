# shadcn-vue UI 体系重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Monorepo 结构下引入 shadcn-vue 作为基础 UI 底座，统一使用 `cn()` + CVA 管理 class，保留 Pencil 设计系统双轨制，分三批替换现有 primitive，提升 UI 一致性和可访问性。

**Architecture:** shadcn-vue 组件位于 `packages/webui/src/components/ui/`，使用标准 CSS 变量（`--background`、`--primary` 等）。业务组件继续使用 Pencil tokens（`bg-surface-1`、`text-text-primary` 等）。复杂业务交互自行封装，不魔改 shadcn 源码。

**Tech Stack:** Vue 3, Tailwind CSS v4, shadcn-vue, Radix Vue, class-variance-authority, tailwind-merge, clsx

---

## 前置条件

- #12（Monorepo 结构迁移）已完成
- `packages/webui/` 目录存在且构建正常
- `pnpm-workspace.yaml` 已配置

---

## File Structure

```
packages/webui/src/
  components/
    ui/                    # shadcn-vue 组件（通过 CLI 生成）
      button/
        Button.vue
        index.ts
      input/
      textarea/
      dialog/
      label/
      dropdown-menu/
      select/
      tabs/
      switch/
      separator/
      badge/
      card/
      skeleton/
      tooltip/
      avatar/
    ConfirmDialog.vue      # 业务封装（基于 ui/dialog）
    EditKbDialog.vue       # 业务封装（基于 ui/dialog）
    MoveCopyDialog.vue     # 业务封装（基于 ui/dialog）
    ContextMenu.vue        # 业务封装（基于 ui/dropdown-menu）
    ...                    # 其他业务组件
  lib/
    utils.ts               # cn() 工具函数
  assets/
    main.css               # 更新：添加 shadcn CSS 变量 + Pencil tokens
```

---

### Task 1: 初始化 shadcn-vue

**Files:**
- Create: `packages/webui/components.json`
- Create: `packages/webui/src/lib/utils.ts`
- Modify: `packages/webui/src/assets/main.css`
- Modify: `packages/webui/package.json`
- Modify: `packages/webui/tsconfig.json`

- [ ] **Step 1: 安装 shadcn-vue CLI 和依赖**

```bash
cd packages/webui
npx shadcn-vue@latest init
```

交互式配置：
- Style: `Default`
- Base color: `Slate`（后续会覆盖为 Pencil tokens）
- CSS file location: `src/assets/main.css`
- Tailwind config: `src/assets/main.css`（Tailwind v4 使用 CSS-based config）
- Components alias: `@/components`
- Utils alias: `@/lib/utils`
- TypeScript: `Yes`

- [ ] **Step 2: 确认生成的文件**

检查生成的文件：
- `packages/webui/components.json`
- `packages/webui/src/lib/utils.ts`
- `packages/webui/tsconfig.json` 中的 path alias

- [ ] **Step 3: 验证 cn() 工具函数**

`packages/webui/src/lib/utils.ts` 应包含：

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 4: 更新 main.css 添加 shadcn 变量**

在 `packages/webui/src/assets/main.css` 中添加：

```css
@import 'tailwindcss';
@plugin '@egoist/tailwindcss-icons';

/* ── shadcn-vue 接口层 ── */
:root {
  --background: 228 20% 97.6%;
  --foreground: 220 18% 14%;
  --card: 0 0% 100%;
  --card-foreground: 220 18% 14%;
  --popover: 0 0% 100%;
  --popover-foreground: 220 18% 14%;
  --primary: 228 94% 67%;
  --primary-foreground: 0 0% 100%;
  --secondary: 220 14% 95.3%;
  --secondary-foreground: 220 18% 14%;
  --muted: 220 14% 95.3%;
  --muted-foreground: 218 10% 52%;
  --accent: 220 14% 93.3%;
  --accent-foreground: 220 18% 14%;
  --destructive: 5 42% 50%;
  --destructive-foreground: 0 0% 100%;
  --border: 220 14% 91.8%;
  --input: 220 14% 91.8%;
  --ring: 228 94% 67%;
  --radius: 0.625rem;
}

/* ── Dark Mode 预留 ── */
.dark {
  --background: 220 18% 10%;
  --foreground: 220 14% 96%;
  --card: 220 18% 12%;
  --card-foreground: 220 14% 96%;
  --popover: 220 18% 12%;
  --popover-foreground: 220 14% 96%;
  --primary: 228 94% 67%;
  --primary-foreground: 220 18% 10%;
  --secondary: 220 14% 18%;
  --secondary-foreground: 220 14% 96%;
  --muted: 220 14% 18%;
  --muted-foreground: 220 10% 60%;
  --accent: 220 14% 22%;
  --accent-foreground: 220 14% 96%;
  --destructive: 5 60% 55%;
  --destructive-foreground: 0 0% 100%;
  --border: 220 14% 20%;
  --input: 220 14% 20%;
  --ring: 228 94% 67%;
}

/* ── Pencil 设计 tokens（保留）── */
@theme {
  --font-sans: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Ubuntu, Cantarell, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'Geist Mono', 'Cascadia Code', Consolas, Menlo, 'Ubuntu Mono', 'DejaVu Sans Mono', 'Courier New', monospace;
  --color-surface-0: #ffffff;
  --color-surface-1: #f7f8fa;
  --color-surface-2: #f1f3f6;
  --color-surface-3: #eceff3;
  --color-surface-4: #e7eaf0;
  --color-surface-nav: #f2f4f7;
  --color-nav-active: #e8ebf2;
  --color-tab-ghost: #f0f2f5;
  --color-text-primary: #1f2328;
  --color-text-secondary: #5e6673;
  --color-text-tertiary: #9aa3af;
  --color-border-subtle: rgba(231, 234, 240, 0.6);
  --color-border-default: #e7eaf0;
  --color-accent-500: #5b7cfa;
  --color-accent-400: #7b96fb;
  --color-accent-600: #4a6be8;
  --color-accent-glow: rgba(91, 124, 250, 0.2);
  --color-accent-soft: #eef2ff;
  --color-danger-500: #b4534a;
  --color-danger-400: #c7736b;
  --color-danger-glow: rgba(180, 83, 74, 0.15);
  --color-danger-soft: #fbefee;
  --color-success-500: #4c8f6a;
  --color-success-soft: #eef8f3;
  --color-purple-500: #7c6ee6;
  --color-purple-soft: #f6f1ff;
}

html {
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

body {
  @apply bg-surface-1 text-text-primary;
  font-family: var(--font-sans);
  overflow: hidden;
}

a, button { @apply select-none; }
a { @apply text-accent-500; }
input, textarea { @apply select-auto; }

/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--color-surface-4); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--color-text-tertiary); }

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.no-scrollbar::-webkit-scrollbar { display: none; }
```

- [ ] **Step 5: 验证开发服务器**

```bash
pnpm --filter @goferbot/webui dev
```

Expected: 无报错，页面正常加载

- [ ] **Step 6: Commit**

```bash
git add packages/webui/
git commit -m "feat(ui): initialize shadcn-vue with Pencil design tokens"
```

---

### Task 2: 引入 Button 组件

**Files:**
- Create: `packages/webui/src/components/ui/button/`
- Modify: 所有使用 raw `<button>` 的组件

- [ ] **Step 1: 安装 Button 组件**

```bash
cd packages/webui
npx shadcn-vue add button
```

- [ ] **Step 2: 定制 Button 样式**

修改 `packages/webui/src/components/ui/button/Button.vue`：

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Primitive, type PrimitiveProps } from 'radix-vue'
import { type ButtonVariants, buttonVariants } from '.'
import { cn } from '@/lib/utils'

interface Props extends PrimitiveProps {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
})
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :class="cn(buttonVariants({ variant, size }), props.class)"
  >
    <slot />
  </Primitive>
</template>
```

修改 `packages/webui/src/components/ui/button/index.ts`：

```typescript
import { type VariantProps, cva } from 'class-variance-authority'

export { default as Button } from './Button.vue'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-accent-500 text-white hover:bg-accent-600',
        destructive: 'bg-danger-500 text-white hover:bg-danger-400',
        outline: 'border border-border-default bg-surface-0 hover:bg-surface-1 text-text-primary',
        secondary: 'bg-surface-2 text-text-primary hover:bg-surface-3',
        ghost: 'hover:bg-surface-1 text-text-primary',
        link: 'text-accent-500 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
```

- [ ] **Step 3: 替换 raw button（示例）**

以 `packages/webui/src/components/SideBar.vue` 为例：

```vue
<script setup lang="ts">
import { Button } from '@/components/ui/button'
// ...
</script>

<template>
  <!-- 重构前 -->
  <!-- <button class="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-surface-2 transition-colors"> -->

  <!-- 重构后 -->
  <Button variant="ghost" size="icon" class="w-10 h-10">
    <span class="i-mdi-home text-xl" />
  </Button>
</template>
```

- [ ] **Step 4: 批量替换**

全局搜索并替换所有 raw `<button>`：

```bash
cd packages/webui/src/components
grep -rl "<button" . | grep -v ui/
```

逐个文件替换，优先处理：
- `SideBar.vue`
- `ChatPage.vue`
- `EmptySession.vue`
- `KnowledgeBasePage.vue`
- `HistoryPage.vue`
- `SettingsPage.vue`
- `RecycleBinPage.vue`

- [ ] **Step 5: Commit**

```bash
git add packages/webui/src/components/ui/button/
git add packages/webui/src/components/SideBar.vue  # 等已替换的文件
git commit -m "feat(ui): add shadcn Button and replace raw buttons"
```

---

### Task 3: 引入 Input 和 Textarea

**Files:**
- Create: `packages/webui/src/components/ui/input/`
- Create: `packages/webui/src/components/ui/textarea/`
- Modify: `ChatInput.vue`, `SettingsPage.vue`, `InlineRename.vue`, `EditKbDialog.vue`

- [ ] **Step 1: 安装组件**

```bash
cd packages/webui
npx shadcn-vue add input
npx shadcn-vue add textarea
```

- [ ] **Step 2: 定制 Input 样式**

修改 `packages/webui/src/components/ui/input/Input.vue`：

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useVModel } from '@vueuse/core'
import { cn } from '@/lib/utils'

const props = defineProps<{
  defaultValue?: string | number
  modelValue?: string | number
  class?: HTMLAttributes['class']
}>()

const emits = defineEmits<{
  (e: 'update:modelValue', payload: string | number): void
}>()

const modelValue = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue,
})
</script>

<template>
  <input
    v-model="modelValue"
    :class="cn(
      'flex h-10 w-full rounded-xl border border-border-default bg-surface-0 px-3 py-2 text-sm text-text-primary shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
      props.class,
    )"
  >
</template>
```

- [ ] **Step 3: 定制 Textarea 样式**

类似 Input，但使用 `textarea` 标签，添加 `resize-none` 或 `resize-y`。

- [ ] **Step 4: 替换 raw input/textarea**

- `ChatInput.vue` → `<Textarea>`
- `SettingsPage.vue` → `<Input>`
- `InlineRename.vue` → `<Input>`
- `EditKbDialog.vue` → `<Input>`

- [ ] **Step 5: Commit**

```bash
git add packages/webui/src/components/ui/input/
git add packages/webui/src/components/ui/textarea/
git add packages/webui/src/components/ChatInput.vue  # 等
git commit -m "feat(ui): add shadcn Input, Textarea and replace raw inputs"
```

---

### Task 4: 引入 Dialog 并重构业务 Dialog

**Files:**
- Create: `packages/webui/src/components/ui/dialog/`
- Modify: `ConfirmDialog.vue`, `EditKbDialog.vue`, `MoveCopyDialog.vue`

- [ ] **Step 1: 安装 Dialog**

```bash
cd packages/webui
npx shadcn-vue add dialog
```

- [ ] **Step 2: 定制 Dialog 样式**

修改 `packages/webui/src/components/ui/dialog/DialogContent.vue`，调整：
- 圆角：`rounded-2xl`
- 阴影：`shadow-[0_16px_38px_rgba(0,0,0,0.08)]`
- 背景：`bg-surface-0`
- 边框：`border-border-default`

- [ ] **Step 3: 重构 ConfirmDialog.vue**

```vue
<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  open: boolean
  title: string
  description: string
  type?: 'info' | 'warning' | 'danger'
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm'): void
}>()

const iconMap = {
  info: 'i-mdi-information-circle text-accent-500',
  warning: 'i-mdi-alert text-amber-500',
  danger: 'i-mdi-alert-circle text-danger-500',
}

const confirmVariant = {
  info: 'default' as const,
  warning: 'default' as const,
  danger: 'destructive' as const,
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader class="flex flex-row items-center gap-3">
        <span :class="['text-2xl', iconMap[type ?? 'info']]" />
        <div>
          <DialogTitle>{{ title }}</DialogTitle>
          <DialogDescription>{{ description }}</DialogDescription>
        </div>
      </DialogHeader>
      <DialogFooter class="gap-2">
        <Button variant="outline" @click="emit('update:open', false)">取消</Button>
        <Button :variant="confirmVariant[type ?? 'info']" @click="emit('confirm')">确认</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
```

- [ ] **Step 4: 重构 EditKbDialog.vue 和 MoveCopyDialog.vue**

类似方式，使用 `Dialog` + `Input` + `Button` primitive。

- [ ] **Step 5: Commit**

```bash
git add packages/webui/src/components/ui/dialog/
git add packages/webui/src/components/ConfirmDialog.vue
git add packages/webui/src/components/EditKbDialog.vue
git add packages/webui/src/components/MoveCopyDialog.vue
git commit -m "feat(ui): add shadcn Dialog and refactor business dialogs"
```

---

### Task 5: 引入 Label

**Files:**
- Create: `packages/webui/src/components/ui/label/`
- Modify: `SettingsPage.vue`, `EditKbDialog.vue`

- [ ] **Step 1: 安装 Label**

```bash
cd packages/webui
npx shadcn-vue add label
```

- [ ] **Step 2: 定制样式**

调整颜色为 `text-text-secondary`，字体大小 `text-sm`。

- [ ] **Step 3: 替换表单标签**

```vue
<!-- 重构前 -->
<label class="text-sm text-text-secondary">API Key</label>

<!-- 重构后 -->
<Label>API Key</Label>
```

- [ ] **Step 4: Commit**

```bash
git add packages/webui/src/components/ui/label/
git commit -m "feat(ui): add shadcn Label"
```

---

### Task 6: 引入 DropdownMenu 并重构 ContextMenu

**Files:**
- Create: `packages/webui/src/components/ui/dropdown-menu/`
- Modify: `ContextMenu.vue`, `ModelSelector.vue`

- [ ] **Step 1: 安装 DropdownMenu**

```bash
cd packages/webui
npx shadcn-vue add dropdown-menu
```

- [ ] **Step 2: 定制样式**

调整：
- 背景：`bg-surface-0`
- 边框：`border-border-default`
- 圆角：`rounded-xl`
- 阴影：`shadow-lg`
- Item hover：`hover:bg-surface-1`

- [ ] **Step 3: 重构 ContextMenu.vue**

保留右键定位逻辑（Teleport + 坐标计算），但使用 `DropdownMenu` primitive 渲染菜单项。

- [ ] **Step 4: Commit**

```bash
git add packages/webui/src/components/ui/dropdown-menu/
git add packages/webui/src/components/ContextMenu.vue
git commit -m "feat(ui): add shadcn DropdownMenu and refactor ContextMenu"
```

---

### Task 7: 引入 Select, Tabs, Switch

**Files:**
- Create: `packages/webui/src/components/ui/select/`
- Create: `packages/webui/src/components/ui/tabs/`
- Create: `packages/webui/src/components/ui/switch/`
- Modify: `SettingsPage.vue`, `TabBar.vue`

- [ ] **Step 1: 安装组件**

```bash
cd packages/webui
npx shadcn-vue add select
npx shadcn-vue add tabs
npx shadcn-vue add switch
```

- [ ] **Step 2: 定制样式**

统一调整为 Pencil tokens。

- [ ] **Step 3: 重构 SettingsPage.vue**

替换：
- native `<select>` → `<Select>`
- 自定义 toggle → `<Switch>`
- 标签页 → `<Tabs>`

- [ ] **Step 4: 重构 TabBar.vue**

使用 `<Tabs>` primitive。

- [ ] **Step 5: Commit**

```bash
git add packages/webui/src/components/ui/select/
git add packages/webui/src/components/ui/tabs/
git add packages/webui/src/components/ui/switch/
git add packages/webui/src/components/SettingsPage.vue
git add packages/webui/src/components/TabBar.vue
git commit -m "feat(ui): add shadcn Select, Tabs, Switch and refactor Settings/TabBar"
```

---

### Task 8: 引入 Separator

**Files:**
- Create: `packages/webui/src/components/ui/separator/`
- Modify: `SideBar.vue`, `SettingsPage.vue`

- [ ] **Step 1: 安装**

```bash
cd packages/webui
npx shadcn-vue add separator
```

- [ ] **Step 2: 替换分隔线**

```vue
<!-- 重构前 -->
<div class="h-px bg-border-default my-2" />

<!-- 重构后 -->
<Separator />
```

- [ ] **Step 3: Commit**

```bash
git add packages/webui/src/components/ui/separator/
git commit -m "feat(ui): add shadcn Separator"
```

---

### Task 9: 引入 Badge, Card, Skeleton, Tooltip, Avatar

**Files:**
- Create: `packages/webui/src/components/ui/badge/`
- Create: `packages/webui/src/components/ui/card/`
- Create: `packages/webui/src/components/ui/skeleton/`
- Create: `packages/webui/src/components/ui/tooltip/`
- Create: `packages/webui/src/components/ui/avatar/`
- Modify: 多个业务组件

- [ ] **Step 1: 安装组件**

```bash
cd packages/webui
npx shadcn-vue add badge
npx shadcn-vue add card
npx shadcn-vue add skeleton
npx shadcn-vue add tooltip
npx shadcn-vue add avatar
```

- [ ] **Step 2: 定制样式**

统一调整为 Pencil tokens。

- [ ] **Step 3: 重构业务组件**

- `KnowledgeBasePage.vue` → `<Card>`
- `EmptySession.vue` → `<Card>`
- `ChatLoading.vue` → `<Skeleton>`
- `ChatMessage.vue` → `<Avatar>`
- 全局 `title` → `<Tooltip>`
- `RecycleBinPage.vue` / `FileExplorer.vue` → `<Badge>`

- [ ] **Step 4: Commit**

```bash
git add packages/webui/src/components/ui/badge/
git add packages/webui/src/components/ui/card/
git add packages/webui/src/components/ui/skeleton/
git add packages/webui/src/components/ui/tooltip/
git add packages/webui/src/components/ui/avatar/
git add packages/webui/src/components/KnowledgeBase.vue  # 等
git commit -m "feat(ui): add shadcn Badge, Card, Skeleton, Tooltip, Avatar"
```

---

### Task 10: 统一 class 管理（cn() + CVA）

**Files:**
- Modify: 所有业务组件中的条件 class 数组

- [ ] **Step 1: 全局搜索条件 class 数组**

```bash
cd packages/webui/src/components
grep -rn ':class="\[' . | grep -v ui/
```

- [ ] **Step 2: 逐个重构为 CVA**

示例（`FileExplorer.vue` 中的列表项）：

```typescript
// 重构前
:class="[
  'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer',
  selected ? 'bg-nav-active' : 'hover:bg-surface-2',
]"

// 重构后
import { cva } from 'class-variance-authority'

const itemVariants = cva(
  'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer',
  {
    variants: {
      selected: {
        true: 'bg-nav-active',
        false: 'hover:bg-surface-2',
      },
    },
    defaultVariants: {
      selected: false,
    },
  },
)

// 模板中
:class="cn(itemVariants({ selected: isSelected }))"
```

- [ ] **Step 3: 验证无遗漏**

```bash
grep -rn ':class="\[' packages/webui/src/components | grep -v ui/
```

Expected: 无结果

- [ ] **Step 4: Commit**

```bash
git add packages/webui/src/components/
git commit -m "refactor(ui): unify class management with cn() and CVA"
```

---

### Task 11: 可访问性验证

**Files:**
- 无文件修改，纯验证

- [ ] **Step 1: 键盘导航测试**

| 组件 | Tab | Enter | Escape | Arrow keys |
|------|-----|-------|--------|------------|
| Button | ✅ | ✅ | - | - |
| Input | ✅ | - | - | - |
| Dialog | ✅（trap focus）| ✅ | ✅ | - |
| DropdownMenu | ✅ | ✅ | ✅ | ✅ |
| Select | ✅ | ✅ | ✅ | ✅ |
| Tabs | ✅ | ✅ | - | ✅ |
| Switch | ✅ | ✅ | - | - |
| Tooltip | ✅（focus触发）| - | - | - |

- [ ] **Step 2: Focus ring 检查**

确认所有交互元素有可见的 focus ring（`ring-2 ring-accent-500`）。

- [ ] **Step 3: ARIA 属性检查**

使用浏览器 DevTools 检查：
- Dialog: `role="dialog"`, `aria-modal="true"`
- DropdownMenu: `role="menu"`, `aria-expanded`
- Select: `role="listbox"`, `aria-selected`
- Tabs: `role="tablist"`, `role="tab"`, `aria-selected`
- Switch: `role="switch"`, `aria-checked`

- [ ] **Step 4: Commit（如有修复）**

---

### Task 12: 全面测试验证

**Files:**
- 无文件修改，纯验证

- [ ] **Step 1: 类型检查**

```bash
pnpm --filter @goferbot/webui type-check
```

Expected: 无错误

- [ ] **Step 2: 单元测试**

```bash
pnpm --filter @goferbot/webui test
```

Expected: 全部通过

- [ ] **Step 3: E2E 测试**

```bash
pnpm --filter @goferbot/webui test:e2e
```

Expected: 全部通过

- [ ] **Step 4: 构建验证**

```bash
pnpm --filter @goferbot/webui build
```

Expected: 构建成功

- [ ] **Step 5: Tauri 验证**

```bash
pnpm tauri dev
```

Expected: 应用正常启动，UI 渲染正确

- [ ] **Step 6: 视觉回归测试**

手动检查关键页面：
- [ ] Chat 页面（空态 + 有消息）
- [ ] Knowledge Base 页面（列表 + 文件浏览器）
- [ ] History 页面（列表 + 分页）
- [ ] Settings 页面（所有标签页）
- [ ] Recycle Bin 页面
- [ ] Dialog（确认、编辑、移动）
- [ ] DropdownMenu（右键菜单、模型选择）

- [ ] **Step 7: Commit（如有修复）**

---

### Task 13: 文档更新

**Files:**
- Modify: `CLAUDE.md`
- Modify: `PROGRESS.md`
- Create: `packages/webui/src/components/ui/README.md`

- [ ] **Step 1: 更新 CLAUDE.md**

添加 shadcn-vue 说明：

```markdown
## UI 组件规范

### 基础组件

项目使用 [shadcn-vue](https://www.shadcn-vue.com/) 作为基础 UI 组件库，位于 `packages/webui/src/components/ui/`。

**引入新组件**：
```bash
cd packages/webui
npx shadcn-vue add <component>
```

**定制规则**：
- 最多定制到层级 2（加插槽、调整布局）
- 不魔改 shadcn 源码实现复杂业务逻辑
- 颜色使用 Pencil tokens（`bg-surface-1`, `text-text-primary` 等）
- 保持 focus ring、键盘导航、ARIA 属性

### Class 管理

全项目统一使用 `cn()` + `class-variance-authority`：

```typescript
import { cn } from '@/lib/utils'
import { cva } from 'class-variance-authority'

const variants = cva('base-classes', {
  variants: { size: { sm: 'h-8', default: 'h-10' } }
})

<div :class="cn(variants({ size }), props.class)" />
```
```

- [ ] **Step 2: 创建 ui/README.md**

```markdown
# UI Components

This directory contains shadcn-vue components.

## Rules

1. **Do not modify component structure beyond level 2** (slots, layout tweaks)
2. **Use Pencil design tokens** for colors: `bg-surface-1`, `text-text-primary`, etc.
3. **Preserve accessibility**: focus rings, keyboard navigation, ARIA attributes
4. **Run `npx shadcn-vue add <component>`** to add new components from upstream

## Customization

Each component's style is customized in its `index.ts` (CVA variants) or `.vue` file (template tweaks).
```

- [ ] **Step 3: 更新 PROGRESS.md**

```markdown
## #13 shadcn-vue UI 体系重构

**状态**: ✅ 已完成  
**日期**: 2026-05-14  
**说明**: 引入 shadcn-vue 作为基础 UI 底座，替换所有 raw primitive，统一使用 cn() + CVA，保留 Pencil 设计系统双轨制。
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md PROGRESS.md packages/webui/src/components/ui/README.md
git commit -m "docs(ui): update documentation for shadcn-vue integration"
```

---

## Self-Review

### 1. Spec coverage

| #13 验收标准 | 对应 Task |
|-------------|----------|
| shadcn-vue 初始化 | Task 1 |
| Button 引入 + 替换 | Task 2 |
| Input/Textarea 引入 + 替换 | Task 3 |
| Dialog 引入 + 业务重构 | Task 4 |
| Label 引入 | Task 5 |
| DropdownMenu + ContextMenu 重构 | Task 6 |
| Select/Tabs/Switch 引入 | Task 7 |
| Separator 引入 | Task 8 |
| Badge/Card/Skeleton/Tooltip/Avatar 引入 | Task 9 |
| class 管理统一化 | Task 10 |
| 可访问性验证 | Task 11 |
| 全面测试 | Task 12 |
| 文档更新 | Task 13 |

**无遗漏。**

### 2. Placeholder scan

- 无 "TBD"、"TODO"、"implement later"
- 每个步骤包含具体命令和代码

### 3. Type consistency

- `cn()` 函数统一使用 `@/lib/utils`
- CVA variants 命名一致（`variant`、`size`）
- Pencil tokens 命名与现有系统一致

---

## 执行交接

**Plan complete and saved to `docs/superpowers/plans/2026-05-14-shadcn-vue-integration.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
