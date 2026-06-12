# TanStack Router 项目实践规范

> 适用于：
>
> - TanStack Start
> - TanStack Router
> - SPA 项目
> - SaaS 后台系统
> - Chat 类应用
>
> 推荐技术栈：
>
> - TanStack Router
> - Zustand
> - Alova
> - React

---

# 1. 路由职责划分

## beforeLoad

负责：

- 登录校验
- 权限校验
- 路由重定向

禁止：

- 加载业务数据
- 加载列表数据
- 加载分页数据

示例：

```tsx
beforeLoad: () => {
  const token = useAuthStore.getState().token

  if (!token) {
    throw redirect({
      to: ROUTES.login.path,
    })
  }
}
```

---

## loader

负责：

- 路由参数校验
- 页面上下文准备
- 页面是否允许进入

适合：

```txt
workspaceId 是否存在
sessionId 是否存在
organizationId 是否存在
```

不适合：

```txt
聊天列表
知识库列表
统计数据
分页数据
```

示例：

```tsx
loader: async ({ params }) => {
  const exists = await checkSession(
    params.sessionId
  )

  if (!exists) {
    throw notFound()
  }

  return {
    sessionId: params.sessionId,
  }
}
```

---

## 页面组件

负责：

- UI渲染
- Skeleton
- Empty State
- 局部错误处理
- 数据请求

示例：

```tsx
const { sessionId } =
  Route.useLoaderData()

const {
  data,
  loading,
  error,
} = useRequest(
  () => getMessages(sessionId)
)
```

---

# 2. 推荐路由结构

推荐：

```txt
routes
│
├── __root.tsx
│
├── index.tsx
│
├── login.tsx
│
├── _app.tsx
│
└── _app
    ├── chat.tsx
    ├── chat.$sessionId.tsx
    ├── kb.tsx
    ├── history.tsx
    └── settings.tsx
```

说明：

```txt
index.tsx
负责入口重定向

login.tsx
负责游客页面

_app.tsx
负责鉴权布局

_app/*
负责业务页面
```

---

# 3. 首页重定向

推荐：

```tsx
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    const token =
      useAuthStore.getState().token

    throw redirect({
      to: token
        ? ROUTES.chat.path
        : ROUTES.login.path,
    })
  },
})
```

---

# 4. 登录页处理

登录页必须禁止已登录用户访问。

```tsx
export const Route =
  createFileRoute('/login')({
    beforeLoad: () => {
      const token =
        useAuthStore.getState().token

      if (token) {
        throw redirect({
          to: ROUTES.chat.path,
        })
      }
    },
  })
```

---

# 5. 鉴权布局

_app.tsx

```tsx
export const Route =
  createFileRoute('/_app')({
    beforeLoad: () => {
      const token =
        useAuthStore.getState().token

      if (!token) {
        throw redirect({
          to: ROUTES.login.path,
        })
      }
    },
  })
```

---

# 6. 路由参数

推荐：

```txt
/app/chat/$sessionId
```

页面：

```tsx
const { sessionId } =
  Route.useParams()
```

不要：

```tsx
window.location.pathname
```

---

# 7. Search Params

推荐：

```tsx
const searchSchema = z.object({
  page: z.number().catch(1),
  keyword: z.string().optional(),
})

export const Route =
  createFileRoute('/app/chat')({
    validateSearch: searchSchema,
  })
```

使用：

```tsx
const search =
  Route.useSearch()
```

---

# 8. Error Boundary

推荐每个重要模块配置：

```tsx
errorComponent: ({ error }) => (
  <ErrorState
    title="页面加载失败"
    description={error.message}
  />
)
```

---

# 9. Not Found

推荐：

```tsx
if (!session) {
  throw notFound()
}
```

不要：

```tsx
navigate('/404')
```

---

# 10. Loader返回数据

示例：

```tsx
loader: async ({ params }) => {
  return {
    sessionId: params.sessionId,
    workspaceId: '123',
  }
}
```

读取：

```tsx
const {
  sessionId,
  workspaceId,
} = Route.useLoaderData()
```

---

# 11. Loader设计原则

Loader只放：

✅

```txt
进入页面必须成功的数据
```

例如：

```txt
当前会话
当前工作区
当前组织
```

不要放：

❌

```txt
聊天列表
用户列表
统计数据
知识库列表
```

---

# 12. Alova职责

推荐：

```txt
beforeLoad
↓
鉴权

loader
↓
上下文校验

Alova
↓
业务请求
```

例如：

```tsx
const {
  data,
  loading,
  error,
} = useRequest(
  () => getChatList()
)
```

---

# 13. 路由配置中心

推荐：

src/config/routes.ts

```tsx
export const ROUTES = {
  login: {
    title: '登录',
    path: '/login',
  },

  chat: {
    title: '会话',
    path: '/app/chat',
  },

  kb: {
    title: '知识库',
    path: '/app/kb',
  },

  history: {
    title: '历史记录',
    path: '/app/history',
  },

  settings: {
    title: '设置',
    path: '/app/settings',
  },
} as const
```

---

# 14. 禁止硬编码路径

禁止：

```tsx
navigate({
  to: '/app/chat',
})
```

推荐：

```tsx
navigate({
  to: ROUTES.chat.path,
})
```

---

# 15. 动态路由构造器

推荐：

```tsx
export const ROUTES = {
  chatSession: {
    path: '/app/chat/$sessionId',

    build: (
      sessionId: string
    ) => `/app/chat/${sessionId}`,
  },
}
```

使用：

```tsx
navigate({
  to: ROUTES.chatSession.build(id),
})
```

---

# 16. Sidebar配置

推荐：

```tsx
export const SIDEBAR_NAV = [
  ROUTES.chat,
  ROUTES.kb,
  ROUTES.history,
  ROUTES.settings,
]
```

页面：

```tsx
SIDEBAR_NAV.map(...)
```

避免：

```tsx
'/app/chat'
'/app/kb'
'/app/history'
```

散落在项目各处。

---

# 17. Route文件职责

Route文件只负责：

```txt
beforeLoad
loader
component
errorComponent
head
```

禁止：

```txt
菜单配置
Sidebar配置
权限菜单生成
```

这些统一放配置中心。

---

# 18. 推荐架构

Router
↓
路由控制

Zustand
↓
身份状态

Alova
↓
业务请求

Routes Config
↓
菜单与路径管理

Page Component
↓
UI渲染