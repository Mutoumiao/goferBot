# TanStack Start 参考手册

> 基于 Context7 获取的官方文档整理，用于 GoferBot 前端迁移参考。
> 整理日期：2026-06-05

---

## 1. 项目初始化

```bash
# 创建新项目（带 Tailwind + shadcn/ui）
npm create @tanstack/start@latest --tailwind --add-ons shadcn

# 或分步安装
npm create @tanstack/start@latest
npx shadcn@latest init
```

---

## 2. 核心文件结构

```
app/
├── routes/                    # 文件系统路由
│   ├── __root.tsx             # 根路由（全局布局）
│   ├── index.tsx              # /
│   ├── login.tsx              # /login
│   ├── app/
│   │   ├── route.tsx          # /app 布局
│   │   ├── chat.tsx           # /app/chat
│   │   └── settings.tsx       # /app/settings
├── router.tsx                 # 路由器配置
├── start.ts                   # 全局中间件（可选）
├── client.tsx                 # 客户端入口
├── ssr.tsx                    # SSR 入口
└── api.ts                     # API 路由（可选）
```

---

## 3. 路由系统

### 3.1 根路由（__root.tsx）

```tsx
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  )
}
```

### 3.2 普通路由

```tsx
// app/routes/login.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  return <div>Login</div>
}
```

### 3.3 布局路由

```tsx
// app/routes/app/route.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/app')({
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({ to: '/login' })
    }
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <div>
      <Sidebar />
      <main>
        <Outlet />
      </main>
    </div>
  )
}
```

### 3.4 路由守卫（beforeLoad）

```tsx
export const Route = createFileRoute('/app/chat')({
  beforeLoad: async ({ context }) => {
    // 鉴权检查
    if (!context.user) {
      throw redirect({ to: '/login' })
    }
    
    // 预加载数据
    const data = await fetchChatData()
    return { chatData: data }
  },
  component: ChatPage,
})
```

---

## 4. 服务端函数（createServerFn）

### 4.1 基本用法

```tsx
import { createServerFn } from '@tanstack/react-start'

// GET 请求
export const getUser = createServerFn({ method: 'GET' })
  .handler(async () => {
    const user = await db.getUser()
    return user
  })

// POST 请求 + 参数验证
import { zodValidator } from '@tanstack/zod-adapter'

export const login = createServerFn({ method: 'POST' })
  .validator(zodValidator(z.object({
    email: z.string().email(),
    password: z.string().min(6),
  })))
  .handler(async ({ data }) => {
    const user = await authenticate(data.email, data.password)
    return user
  })
```

### 4.2 客户端调用

```tsx
// 在组件中直接调用
const user = await getUser()
const result = await login({ data: { email, password } })
```

### 4.3 中间件

```tsx
// app/start.ts
import { createStart, createMiddleware } from '@tanstack/react-start'

const authMiddleware = createMiddleware().server(async ({ next }) => {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  return next({ context: { user: session.user } })
})

export const startInstance = createStart(() => ({
  requestMiddleware: [authMiddleware],
}))
```

---

## 5. 数据获取与 TanStack Query

### 5.1 结合 Query 使用

```tsx
import { useQuery } from '@tanstack/react-query'

function ChatPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => getChatMessages({ data: { chatId } }),
  })
  
  if (isLoading) return <Loading />
  return <ChatList messages={data} />
}
```

### 5.2 路由预加载（beforeLoad）

```tsx
export const Route = createFileRoute('/app/chat/$chatId')({
  beforeLoad: async ({ params }) => {
    return await getChatMessages({ data: { chatId: params.chatId } })
  },
  component: ChatPage,
})

function ChatPage() {
  const messages = Route.useLoaderData()
  return <ChatList messages={messages} />
}
```

> 注：TanStack Router 中 `beforeLoad` 是推荐的数据预加载方式，与 `loader` 类似但执行时机更早。

---

## 6. Vite 配置

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tanstackStart(),
    viteReact(),
    tailwind(),
  ],
  resolve: {
    alias: {
      '@': './app',
      '~': './app',
    },
  },
  server: {
    port: 1420,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
```

---

## 7. 部署配置

### 7.1 Node.js 部署

```bash
npm create @tanstack/start@latest --add-ons node
```

### 7.2 Vercel 部署

```bash
npm create @tanstack/start@latest --add-ons vercel
```

### 7.3 Netlify 部署

```ts
// vite.config.ts
import netlify from '@netlify/vite-plugin-tanstack-start'

export default defineConfig({
  plugins: [
    tanstackStart(),
    netlify(),
    viteReact(),
  ],
})
```

### 7.4 SPA 模式

```ts
// app/router.tsx
export function getRouter() {
  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
  })
  return router
}
```

> 注：TanStack Start 默认支持 SSR。如需纯 SPA 模式，可配置 `ssr: false`。

---

## 8. 与 Next.js 的关键差异

| 特性 | TanStack Start | Next.js |
|------|----------------|---------|
| 构建工具 | Vite | Webpack / Turbopack |
| 路由 | TanStack Router（文件系统） | App Router（文件系统） |
| 服务端函数 | `createServerFn`（RPC） | Server Actions |
| SSR | 自动，可配置 | 默认启用 |
| RSC 支持 | 实验性 | 完全支持 |
| 部署 | 多平台适配器 | Vercel 最优 |
| 路由守卫 | `beforeLoad`（组件级） | Middleware（文件级） |
| 数据获取 | `loader` + TanStack Query | Server Components |

---

## 9. 常见问题

### Q: 如何在路由间共享布局？

A: 使用父级路由文件作为布局：
```
routes/
├── app/
│   ├── route.tsx          # AppLayout
│   ├── chat.tsx           # /app/chat
│   └── settings.tsx       # /app/settings
```

### Q: 如何处理 404？

A: 在根路由配置 `notFoundComponent`：
```tsx
export const Route = createRootRoute({
  notFoundComponent: () => <NotFound />,
})
```

### Q: 如何添加全局 CSS？

A: 在根路由导入：
```tsx
import appCss from './styles/app.css?url'

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
})
```

---

## 10. 参考链接

- [TanStack Start 官方文档](https://tanstack.com/start/latest)
- [TanStack Router 文档](https://tanstack.com/router/latest)
- [构建从零开始](https://tanstack.com/start/latest/docs/framework/react/build-from-scratch)
- [服务端函数指南](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- [中间件指南](https://tanstack.com/start/latest/docs/framework/react/guide/middleware)
- [部署指南](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
