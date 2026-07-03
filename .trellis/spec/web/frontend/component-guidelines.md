# 组件指南

> 本项目中组件的构建方式。

---

## 概述

Web 前端组件体系基于 **shadcn/ui** + **Radix UI** + **Tailwind CSS v4**。组件分为三层：
1. **基础 UI 组件**：`components/ui/` 目录下的 shadcn/ui 自动生成组件
2. **业务组件**：`features/*/components/` 目录下的功能模块专属组件
3. **布局组件**：`components/sidebar/`、`components/tab-bar/` 等全局布局组件

---

## 组件结构

### 组件文件标准结构

```tsx
import { cn } from '@/lib/utils'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

interface MyComponentProps extends ComponentPropsWithoutRef<'div'> {
  title: string
  subtitle?: string
  children?: ReactNode
}

export function MyComponent({
  title,
  subtitle,
  children,
  className,
  ...props
}: MyComponentProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)} {...props}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      {children}
    </div>
  )
}
```

### 目录层次

```
components/
├── ui/                   # shadcn/ui 基础组件（自动生成，禁止手动修改）
│   ├── button.tsx
│   ├── dialog.tsx
│   └── ...
├── sidebar/              # 全局布局组件
│   └── Sidebar.tsx
└── tab-bar/              # 全局布局组件
    ├── TabBar.tsx
    └── TabRouteSync.tsx

features/
└── chat/
    └── components/       # 业务组件（功能模块专属）
        ├── ChatMessage.tsx
        ├── ChatSessionView.tsx
        └── ...
```

---

## Props 约定

### 基础规则

1. **扩展原生元素 Props**：使用 `ComponentPropsWithoutRef<'div'>` 或 `ComponentPropsWithRef<'button'>` 扩展原生元素属性
2. **className 合并**：始终使用 `cn()` 函数合并 className，确保 Tailwind 类名正确覆盖
3. **可选 props**：非必需的 props 使用 `?` 标记
4. **类型定义位置**：组件专属类型定义放在组件文件内部或同目录的 `types.ts`

### Props 排序

按以下顺序排列 props：

```tsx
export function MyComponent({
  // 必需 props（按业务重要性排序）
  title,
  items,
  
  // 可选 props（按频率排序）
  variant = 'default',
  size = 'md',
  
  // 通用 props
  className,
  children,
  ...props
}: MyComponentProps) {
  // ...
}
```

### 事件处理

事件处理函数使用 `on*` 命名约定，并接受 `React.*Event` 类型：

```tsx
interface ButtonProps {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  onFocus?: (event: React.FocusEvent<HTMLButtonElement>) => void
}
```

---

## 样式模式

### Tailwind CSS v4

项目使用 Tailwind CSS v4，样式通过 CSS 文件导入：

```css
/* globals.css */
@import "tailwindcss";

@theme {
  --color-primary: oklch(0.75 0.2 250);
  --color-background: oklch(0.98 0.002 280);
  --font-sans: 'Inter', system-ui, sans-serif;
}
```

### 组件样式

组件样式优先使用 Tailwind 工具类，复杂样式使用 `@layer utilities` 或 `@layer components`：

```tsx
// 使用 Tailwind 工具类
<div className="flex items-center gap-2">
  {/* ... */}
</div>

// 复杂样式定义在 globals.css
@layer components {
  .chat-bubble {
    border-radius: var(--radius-lg);
    padding: var(--spacing-3);
  }
}
```

### className 合并工具

使用 `cn()` 函数（来自 `@/lib/utils`）合并 className：

```tsx
import { cn } from '@/lib/utils'

<div className={cn('base-class', condition && 'conditional-class', className)} />
```

---

## 组合模式

### shadcn/ui 组合模式

使用 shadcn/ui 的组件组合模式构建复杂 UI：

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Action</DialogTitle>
      <DialogDescription>Are you sure?</DialogDescription>
    </DialogHeader>
    {/* ... */}
  </DialogContent>
</Dialog>
```

### 业务组件组合

业务组件通过 props 和 children 进行组合：

```tsx
<ChatSessionView session={session}>
  <ChatMessageList messages={messages} />
  <ChatInput onSend={handleSend} />
</ChatSessionView>
```

---

## 无障碍

### 基础要求

1. **语义化标签**：优先使用语义化 HTML 标签（`<button>`, `<a>`, `<nav>`）而非 `<div>`
2. **表单标签关联**：使用 `htmlFor` 属性关联 label 和 input
3. **键盘导航**：确保所有交互元素可通过键盘访问
4. **ARIA 属性**：使用适当的 ARIA 属性增强可访问性

### 表单无障碍

```tsx
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" aria-required="true" />
</div>
```

### 复杂组件无障碍

```tsx
// 自定义可访问性属性
<div
  role="dialog"
  aria-modal="true"
  aria-label="Confirm deletion"
  tabIndex={-1}
>
  {/* ... */}
</div>
```

---

## 组件分类

### UI 组件（shadcn/ui）

位于 `components/ui/`，由 shadcn/ui CLI 自动生成。**禁止手动修改**，如需自定义，创建 wrapper 组件。

### 业务组件

位于 `features/*/components/`，实现特定业务功能。包含：
- **页面组件**：如 `ChatPageByTab.tsx`
- **列表组件**：如 `ChatHistoryList.tsx`
- **表单组件**：如 `LoginForm.tsx`
- **展示组件**：如 `ChatMessage.tsx`

### 布局组件

位于 `components/` 根目录，提供全局布局能力：
- `Sidebar.tsx`：侧边栏导航
- `TabBar.tsx`：标签页导航

---

## 常见错误

### 错误示例

| 错误 | 描述 | 修复方式 |
|------|------|----------|
| 使用 `div` 代替语义化标签 | `<div onClick={...}>Click</div>` | 使用 `<button onClick={...}>Click</button>` |
| 直接修改 shadcn/ui 组件 | 修改 `components/ui/button.tsx` | 创建 wrapper 组件或使用 className 覆盖 |
| 缺少 `htmlFor` 属性 | `<label>Name</label><input />` | 添加 `htmlFor` 和 `id` |
| 硬编码样式 | 使用内联 `style={{}}` | 使用 Tailwind 类或 CSS 变量 |
| 未使用 `cn()` 合并 className | `className={`base ${condition ? 'extra' : ''}`}` | `className={cn('base', condition && 'extra')}` |

### 正确示例

```tsx
// ✅ 正确：语义化标签 + cn 合并 + htmlFor
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function SearchInput({ value, onChange, className }: SearchInputProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor="search">Search</Label>
      <Input
        id="search"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search..."
        className={cn('w-full', className)}
      />
    </div>
  )
}
```

---

## 代码引用

| 规范 | 参考文件 |
|------|----------|
| cn() 工具函数 | `packages/web/src/lib/utils.ts` |
| shadcn/ui 基础组件 | `packages/web/src/components/ui/` |
| 业务组件示例 | `packages/web/src/features/chat/components/ChatMessage.tsx` |
| 布局组件示例 | `packages/web/src/components/sidebar/Sidebar.tsx` |
| Tailwind 主题配置 | `packages/web/src/globals.css` |