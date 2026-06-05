# shadcn/ui 使用参考

> 用于 GoferBot 前端迁移，覆盖安装、配置、常用组件及与 Vue 项目的差异。
> 整理日期：2026-06-05

---

## 1. 安装与初始化

### 1.1 在 TanStack Start 中初始化

```bash
# 方式一：创建项目时直接包含
npm create @tanstack/start@latest --tailwind --add-ons shadcn

# 方式二：已有项目中添加
npx shadcn@latest init
```

### 1.2 配置路径别名

确保 `components.json` 中的路径与项目一致：

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### 1.3 安装组件

```bash
# 单个组件
npx shadcn@latest add button

# 多个组件
npx shadcn@latest add button input dialog

# 全部组件
npx shadcn@latest add --all
```

---

## 2. 常用组件速查

### 2.1 Button

```tsx
import { Button } from "@/components/ui/button"

// 变体
<Button>Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// 尺寸
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>

// 状态
<Button disabled>Disabled</Button>
<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Loading
</Button>
```

### 2.2 Input

```tsx
import { Input } from "@/components/ui/input"

<Input type="email" placeholder="Email" />
<Input type="password" />
<Input disabled />
```

### 2.3 Dialog

> **注意**：本项目使用命令式 Overlay 系统管理弹窗，不直接使用 shadcn/ui 的声明式 Dialog。详见 [Overlay 规范](../guide/frontend/overlay-conventions.md)。
>
> shadcn/ui 的 Dialog 组件作为底层实现，被包装在 Overlay 系统中提供命令式调用。

**底层组件（供 Overlay 系统内部使用）**：
```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// 在 overlays/dialogs/MyDialog.tsx 中使用
export function MyDialog({ onClose, onConfirm, title }: MyDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {/* 内容 */}
      </DialogContent>
    </Dialog>
  )
}
```

**业务调用（命令式）**：
```tsx
import { openDialog } from '@/overlays'
import MyDialog from '@/overlays/dialogs/MyDialog'

// 在业务组件中调用
openDialog(MyDialog, {
  title: '确认删除',
  onConfirm: async () => { await deleteItem() },
})
```

### 2.4 Form（结合 react-hook-form）

```tsx
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export function LoginForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="email@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}
```

### 2.5 Table

```tsx
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

<Table>
  <TableCaption>A list of users.</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Email</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {users.map(user => (
      <TableRow key={user.id}>
        <TableCell>{user.name}</TableCell>
        <TableCell>{user.email}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### 2.6 Dropdown Menu

> **注意**：ContextMenu 同样使用命令式 Overlay 系统。详见 [Overlay 规范](../guide/frontend/overlay-conventions.md)。

**底层组件（供 Overlay 系统内部使用）**：
```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

// 在 overlays/context-menus/MyMenu.tsx 中使用
export function MyMenu({ x, y, onClose, onAction }: MyMenuProps) {
  return (
    <DropdownMenu open={true} onOpenChange={onClose}>
      <DropdownMenuContent style={{ position: 'fixed', left: x, top: y }}>
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onAction('edit')}>Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction('delete')}>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**业务调用（命令式）**：
```tsx
import { openContextMenu } from '@/overlays'
import MyMenu from '@/overlays/context-menus/MyMenu'

// 在业务组件中调用
function onRightClick(e: React.MouseEvent) {
  openContextMenu(MyMenu, {
    x: e.clientX,
    y: e.clientY,
    onAction: (action) => { ... },
  })
}
```

### 2.7 Tabs

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

<Tabs defaultValue="account" className="w-[400px]">
  <TabsList>
    <TabsTrigger value="account">Account</TabsTrigger>
    <TabsTrigger value="password">Password</TabsTrigger>
  </TabsList>
  <TabsContent value="account">Account settings.</TabsContent>
  <TabsContent value="password">Password settings.</TabsContent>
</Tabs>
```

### 2.8 Toast

```tsx
import { useToast } from "@/components/ui/use-toast"

export function Component() {
  const { toast } = useToast()

  return (
    <Button
      onClick={() => {
        toast({
          title: "Scheduled: Catch up",
          description: "Friday, February 10, 2024 at 5:57 PM",
        })
      }}
    >
      Show Toast
    </Button>
  )
}
```

---

## 3. 与 Vue 项目的差异

| 特性 | Vue (shadcn-vue) | React (shadcn/ui) |
|------|------------------|-------------------|
| 安装命令 | `npx shadcn-vue@latest add button` | `npx shadcn@latest add button` |
| 组件导入 | 自动（unplugin-vue-components） | 手动 `import { Button } from "@/components/ui/button"` |
| 事件绑定 | `@click` | `onClick` |
| 插槽 | `v-slot` / `#header` | `children` prop / render props |
| 双向绑定 | `v-model` | `value` + `onChange` |
| 条件渲染 | `v-if` | `{condition && <Component />}` |
| 列表渲染 | `v-for` | `.map()` |

---

## 4. 自定义主题

### 4.1 修改 CSS 变量

```css
/* app/globals.css */
@theme {
  --color-primary: hsl(222.2 47.4% 11.2%);
  --color-primary-foreground: hsl(210 40% 98%);
  --color-secondary: hsl(210 40% 96.1%);
  --color-secondary-foreground: hsl(222.2 47.4% 11.2%);
  --color-destructive: hsl(0 84.2% 60.2%);
  --color-muted: hsl(210 40% 96.1%);
  --color-muted-foreground: hsl(215.4 16.3% 46.9%);
  --color-accent: hsl(210 40% 96.1%);
  --color-accent-foreground: hsl(222.2 47.4% 11.2%);
  --color-border: hsl(214.3 31.8% 91.4%);
  --color-input: hsl(214.3 31.8% 91.4%);
  --color-ring: hsl(222.2 84% 4.9%);
  --radius: 0.5rem;
}
```

### 4.2 组件级覆盖

```tsx
import { cn } from "@/lib/utils"

// 使用 cn 合并类名
<Button className={cn("bg-blue-600 hover:bg-blue-700", className)} >
  Custom Button
</Button>
```

---

## 5. Overlay 系统与 shadcn/ui 的关系

| 层级 | 用途 | 说明 |
|------|------|------|
| **Overlay 系统** | 命令式调用接口 | `openDialog()` / `openContextMenu()`，业务层使用 |
| **shadcn/ui 组件** | 底层 UI 实现 | Dialog / DropdownMenu 等，Overlay 系统内部使用 |
| **Radix UI** | 基础交互逻辑 | 焦点管理、ESC 关闭、滚动锁定等 |

**为什么不用 shadcn/ui 的声明式 Dialog？**
- 命令式调用更符合业务场景（如确认框、提示框）
- 统一管理便于全局控制（关闭所有、层级、动画）
- 与 Vue 项目保持一致的开发体验

## 6. 常见问题

### Q: 如何添加新组件？

```bash
npx shadcn@latest add [component-name]
```

### Q: 如何更新组件？

```bash
npx shadcn@latest add [component-name] --overwrite
```

### Q: 如何自定义组件源码？

直接修改 `components/ui/` 下的组件文件，这些文件属于你的项目代码。

### Q: 如何处理表单验证？

推荐结合 `react-hook-form` + `zod`：
```bash
npm install react-hook-form @hookform/resolvers zod
```

### Q: 为什么 Dialog 不直接用 shadcn/ui 的声明式写法？

本项目采用命令式 Overlay 系统管理弹窗，详见 [Overlay 规范](../guide/frontend/overlay-conventions.md)。shadcn/ui 的 Dialog 作为底层实现被包装在 Overlay 系统中。

---

## 参考

- [shadcn/ui 官方文档](https://ui.shadcn.com)
- [shadcn/ui GitHub](https://github.com/shadcn-ui/ui)
- [Radix UI Primitives](https://www.radix-ui.com/primitives)
