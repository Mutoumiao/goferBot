# Alova React 请求库参考手册

> 基于 Context7 获取的 alova v3 官方文档整理，用于 GoferBot 前端数据请求层参考。
> 整理日期：2026-06-07

---

## 1. 概述

Alova 是轻量级 API 请求库，核心特性：请求共享、响应缓存、20+ 业务模块 hook。v3 统一了导入路径，所有客户端 hooks 从 `alova/client` 导入。

**适用场景**：替代手写 fetch/axios 封装，以 hook 形式管理请求状态（loading/data/error），减少样板代码。

与项目中已有的 TanStack Query 相比，alova 更轻量且 hooks 更细分（如 `usePagination`、`useForm` 内置分页/表单逻辑），两者可互补使用。

---

## 2. 安装

```bash
npm install alova
```

无需额外安装 `@alova/client` — v3 将 hooks 内聚到 `alova` 包中，通过子路径导出。

---

## 3. 导入路径速查

v3 统一了导入路径，**务必使用以下方式**：

| 导入目标 | 路径 | 说明 |
|----------|------|------|
| `createAlova` | `alova` | 创建实例的工厂函数 |
| `ReactHook` | `alova/react` | React 状态管理适配器 |
| `adapterFetch` (default) | `alova/fetch` | 浏览器 Fetch 适配器（v3.5+ 默认导出，需 `import adapterFetch from 'alova/fetch'`） |
| `useRequest` | `alova/client` | 基础请求 hook |
| `useWatcher` | `alova/client` | 状态监听请求 hook |
| `useFetcher` | `alova/client` | 手动按需拉取 hook |
| `usePagination` | `alova/client` | 分页管理 hook |
| `useForm` | `alova/client` | 表单管理 hook |
| `useRetriableRequest` | `alova/client` | 自动重试 hook |
| `useSerialRequest` | `alova/client` | 串行请求 hook |
| `useUploader` | `alova/client` | 文件上传 hook |
| `useSSE` | `alova/client` | SSE 流式请求 hook |
| `useAutoRequest` | `alova/client` | 条件触发请求 hook |
| `invalidateCache` | `alova/client` | 缓存失效工具函数 |
| `globalConfig` | `alova` | 全局默认配置 |

> **v2 迁移提醒**：v2 的 `import { useRequest } from 'alova'` 和 `import { usePagination } from '@alova/scene-react'` 在 v3 中全部改为 `import { ... } from 'alova/client'`。

---

## 4. Alova 实例配置

### 4.1 最小配置

```typescript
import { createAlova } from 'alova'
import ReactHook from 'alova/react'
import adapterFetch from 'alova/fetch'  // v3.5+ default export

const alovaInstance = createAlova({
  statesHook: ReactHook,                         // 必须 — 绑定 React 状态管理
  requestAdapter: adapterFetch(),          // 请求适配器
  baseURL: 'https://api.example.com',
})
```

### 4.2 完整配置

```typescript
import { createAlova, globalConfig } from 'alova'
import ReactHook from 'alova/react'
import adapterFetch from 'alova/fetch'  // v3.5+ default export
import { memoryAdapter, localStorageAdapter } from 'alova'

// 全局默认设置（可选，影响所有实例）
globalConfig({
  autoHitCache: 'global',
  ssr: false,
})

export const alovaInstance = createAlova({
  // 实例标识（调试用）
  id: 'main-api',

  // 必须
  statesHook: ReactHook,
  requestAdapter: adapterFetch(),

  // 基础配置
  baseURL: 'https://api.example.com',
  timeout: 30000,

  // 请求共享：多个相同请求并发时合并为一个
  shareRequest: true,

  // 响应缓存（按 HTTP 方法配置，单位毫秒）
  cacheFor: {
    GET: 300_000,          // 5 分钟
    POST: 0,               // 不缓存
    PUT: {
      expire: 600_000,
      mode: 'restore',     // restore | memory
    },
  },

  // 缓存存储适配器
  l1Cache: memoryAdapter(),          // 内存缓存（默认）
  l2Cache: localStorageAdapter(),    // 持久化缓存（可选）

  // 快照数量上限
  snapshots: 1000,

  // 请求前拦截器
  beforeRequest(method) {
    const token = localStorage.getItem('token')
    if (token) {
      method.config.headers.Authorization = `Bearer ${token}`
    }
  },

  // 响应拦截器
  responded: {
    onSuccess: async (response, method) => {
      const json = await response.json()
      if (json.code !== 200) {
        throw new Error(json.message)
      }
      return json.data                      // 返回给 hook 的 data
    },
    onError: (error, method) => {
      console.error(`[${method.url}] 请求失败:`, error)
      throw error
    },
  },
})
```

### 4.3 多实例模式

在大型项目中可按业务域拆分多个实例：

```typescript
// api/instances.ts
export const mainApi = createAlova({
  id: 'main',
  statesHook: ReactHook,
  baseURL: '/api',
  // ...
})

export const cdnApi = createAlova({
  id: 'cdn',
  statesHook: ReactHook,
  baseURL: 'https://cdn.example.com',
  cacheFor: { GET: 3600_000 },  // CDN 资源缓存 1 小时
})
```

---

## 5. 核心 Hooks

### 5.1 useRequest — 基础请求

管理 `loading` / `data` / `error` 三元状态，组件的"主力 hook"。

```tsx
import { useRequest } from 'alova/client'

function UserProfile({ userId }: { userId: number }) {
  const { data, loading, error, send, abort, update } = useRequest(
    () => alovaInstance.Get(`/api/users/${userId}`),
    {
      immediate: true,                         // 组件挂载时立即请求
      initialData: { name: '加载中...' },       // data 初始值
      force: false,                            // true = 跳过缓存强制请求
    }
  )

  if (loading)   return <div>加载中...</div>
  if (error)     return <div>错误: {error.message}</div>

  return (
    <div>
      <p>用户: {data.name}</p>
      <button onClick={() => send()}>刷新</button>
      <button onClick={() => abort()}>取消</button>
    </div>
  )
}
```

**手动触发（带参数）**：

```tsx
const { send } = useRequest(
  (id: number) => alovaInstance.Get(`/api/users/${id}`),
  { immediate: false }
)

// send 返回 Promise，await 拿到响应数据
const handleClick = async () => {
  const result = await send(123)
  console.log('结果:', result)
}
```

**事件回调**：

```tsx
const { onSuccess, onError, onComplete } = useRequest(
  () => alovaInstance.Get('/api/todos'),
  { immediate: true }
)

onSuccess(event => {
  console.log('数据:', event.data)
  console.log('来自缓存:', event.fromCache)     // 区分缓存命中
})

onError(event => {
  console.error('请求失败:', event.error)
})

onComplete(event => {
  console.log('请求结束（无论成败）')
})
```

**手动更新状态**（乐观更新等场景）：

```tsx
const { update } = useRequest(...)

// 直接修改本地状态，不发起请求
update({
  data: { name: '乐观更新值' },
  loading: false,
})
```

### 5.2 useWatcher — 监听状态变化自动请求

当被监听的 React 状态变化时自动重新请求，适合搜索、筛选、依赖刷新等场景。

```tsx
import { useWatcher } from 'alova/client'
import { useState } from 'react'

function SearchPage() {
  const [keywords, setKeywords] = useState('')
  const [category, setCategory] = useState('all')

  const { data, loading, error, send } = useWatcher(
    () => alovaInstance.Get('/api/search', {
      params: { q: keywords, category }
    }),
    [keywords, category],            // 监听这两个 state
    {
      immediate: true,               // 挂载时立即执行一次
      debounce: 500,                 // 500ms 防抖（值稳定后才发请求）
      abortLast: true,               // 新请求到来时取消上一个（竞态处理）
    }
  )

  return (
    <div>
      <input
        value={keywords}
        onChange={e => setKeywords(e.target.value)}
        placeholder="搜索..."
      />
      {loading && <div>搜索中...</div>}
      {data?.results.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  )
}
```

**关键配置项**：

| 配置 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `immediate` | boolean | true | 挂载时是否立即请求 |
| `debounce` | number | 0 | 防抖延迟（ms），状态变化后等待该时长再请求 |
| `abortLast` | boolean | false | 新请求到来时是否取消上一个未完成的请求 |
| `force` | boolean | false | 是否跳过缓存 |

### 5.3 useFetcher — 手动按需拉取

不自动触发，适合预加载、点击触发的非主数据流拉取。

```tsx
import { useFetcher } from 'alova/client'

function PrefetchButtons() {
  const { fetch, loading, data, error } = useFetcher({
    updateState: true,         // 将拉取结果更新到组件状态
  })

  const handlePrefetch = async (userId: number) => {
    const result = await fetch(
      alovaInstance.Get(`/api/users/${userId}`)
    )
    console.log('预拉取结果:', result)
  }

  return (
    <div>
      <button onClick={() => handlePrefetch(1)}>
        {loading ? '拉取中...' : '预加载用户 1'}
      </button>
      {detail && <p>{JSON.stringify(detail)}</p>}
    </div>
  )
}
```

**对比 useFetcher vs useRequest**：

| | useRequest | useFetcher |
|---|---|---|
| 自动触发 | ✅ `immediate: true` | ❌ 仅手动 `fetch()` |
| 管理组件状态 | ✅ loading/data/error | ✅ 当 `updateState: true` |
| 典型场景 | 页面主数据 | 预加载、按钮触发加载 |
| 跨组件状态 | 按缓存 key 共享 | 可配置 `updateState` 影响全局 |

### 5.4 usePagination — 分页管理

一站式分页：页码、页大小、数据列表、总数、预加载前后页、增删列表项。

```tsx
import { usePagination } from 'alova/client'

function UserList() {
  const {
    page, pageSize, data, total,
    isLastPage, pageCount, loading,
    setPage, setPageSize,
    insert, remove, replace, refresh,
  } = usePagination(
    (page, pageSize) => alovaInstance.Get('/api/users', {
      params: { page, pageSize },
    }),
    {
      initialPage: 1,
      initialPageSize: 20,
      preloadPreviousPage: true,               // 预加载上一页数据
      preloadNextPage: true,                   // 预加载下一页数据
      data: (response) => response.users,      // 从响应中提取列表
      total: (response) => response.total,     // 从响应中提取总数
      watchingStates: [],                      // 额外的监听状态（类似 useWatcher）
    }
  )

  return (
    <div>
      <p>第 {page}/{pageCount} 页（共 {total} 条）</p>

      {data.map(user => (
        <div key={user.id}>
          {user.name}
          <button onClick={() => remove(user)}>删除</button>
        </div>
      ))}

      <div>
        <button onClick={() => setPage(page - 1)} disabled={page === 1}>
          上一页
        </button>
        <button onClick={() => setPage(page + 1)} disabled={isLastPage}>
          下一页
        </button>
        <button onClick={() => refresh()}>刷新当前页</button>
      </div>
    </div>
  )
}
```

**列表操作**：

```tsx
// 向列表插入一条（顶部或指定位置）
insert(newItem, 0)

// 删除一条
remove(existingItem)

// 替换一条
replace(updatedItem, existingItem)

// 手动更新整个列表数据
update({ data: newItems })
```

### 5.5 useForm — 表单管理

```tsx
import { useForm } from 'alova/client'

function CreatePostForm() {
  const { form, loading, send, onSuccess, onError, reset } = useForm(
    (formData) => alovaInstance.Post('/api/posts', formData),
    {
      initialData: { title: '', body: '' },
      resetAfterSubmitting: true,         // 提交成功后重置表单
    }
  )

  onSuccess(({ data }) => {
    console.log('创建成功:', data)
  })

  onError(({ error }) => {
    console.error('创建失败:', error.message)
  })

  return (
    <form onSubmit={e => { e.preventDefault(); send(form) }}>
      <input
        value={form.title}
        onChange={e => form.title = e.target.value}
        placeholder="标题"
      />
      <textarea
        value={form.body}
        onChange={e => form.body = e.target.value}
        placeholder="内容"
      />
      <button type="submit" disabled={loading}>
        {loading ? '提交中...' : '提交'}
      </button>
      <button type="button" onClick={reset}>重置</button>
    </form>
  )
}
```

### 5.6 useRetriableRequest — 自动重试

```tsx
import { useRetriableRequest } from 'alova/client'

function UnstableDataView() {
  const { loading, data, error, onRetry, onFail } = useRetriableRequest(
    alovaInstance.Get('/api/unstable'),
    {
      retry: 5,                        // 最多重试 5 次
      backoff: {
        delay: 2000,                   // 每次重试间隔 2 秒
      },
    }
  )

  onRetry((event) => {
    console.log(`第 ${event.retryTimes} 次重试...`)
  })

  onFail((event) => {
    console.error('重试耗尽，最终失败:', event.error)
  })

  if (loading) return <div>加载中...</div>
  if (error)  return <div>多次重试仍失败: {error.message}</div>
  return <div>{JSON.stringify(data)}</div>
}
```

---

## 6. 请求方法（Method）

通过 `alovaInstance` 创建 method 实例，支持链式配置：

```typescript
// GET — 最常用
alovaInstance.Get('/users', {
  params: { id: 1 },
  headers: { 'X-Custom': 'value' },
})

// POST
alovaInstance.Post('/posts', {
  title: 'foo',
  body: 'bar',
  userId: 1,
})

// PUT
alovaInstance.Put('/posts/1', { title: 'updated' })

// DELETE
alovaInstance.Delete('/posts/1')
```

**method 实例可独立配置缓存**：

```typescript
const getUsers = alovaInstance.Get('/users', {
  cacheFor: 600_000,          // 为该接口单独设置缓存
  timeout: 10_000,            // 单独设置超时
  transformData(data) {       // 响应数据转换
    return data.items
  },
})
```

---

## 7. 缓存操作

### 7.1 缓存模式

| 模式 | 说明 |
|------|------|
| `memory`（默认） | 缓存仅在内存中，刷新页面即失效 |
| `restore` | 缓存持久化（需配置 l2Cache，如 localStorageAdapter），恢复时先显示缓存数据，后台更新 |
| `placehoder` | 占位模式，展示初始数据后后台更新 |

### 7.2 缓存操作 API

```typescript
import { invalidateCache, setCache, queryCache } from 'alova/client'

// 使特定请求的缓存失效
invalidateCache(getUserInfo(userId))

// 按 method 实例失效
const method = alovaInstance.Get('/users')
invalidateCache(method)

// 设置缓存
setCache(method, cachedData)

// 查询缓存（同步）
const cached = queryCache(method)
```

### 7.3 自动缓存命中策略

```typescript
import { globalConfig } from 'alova'

globalConfig({
  autoHitCache: 'global',     // 全局启用缓存命中
  // 可选: 'global' | 'self' | 'close' | 自定义函数
})
```

---

## 8. 与 GoferBot 项目集成建议

### 8.1 实例创建（推荐位置：`packages/web/api/instance.ts`）

```typescript
// packages/web/api/instance.ts
import { createAlova } from 'alova'
import ReactHook from 'alova/react'
import adapterFetch from 'alova/fetch'  // v3.5+ default export

export const api = createAlova({
  id: 'goferbot',
  statesHook: ReactHook,
  requestAdapter: adapterFetch(),
  baseURL: '/api',                      // 与 Vite proxy 配合
  timeout: 30_000,

  beforeRequest(method) {
    const token = localStorage.getItem('goferbot_access_token')
    if (token) {
      method.config.headers.Authorization = `Bearer ${token}`
    }
  },

  responded: {
    onSuccess: async (response) => {
      const json = await response.json()
      // GoferBot 统一响应格式: { data: T }
      // ResponseInterceptor 已包装，此处无需再解包
      // 若需要错误处理，检查 json.code 等业务状态码
      return json
    },
    onError: (error, method) => {
      if (error.status === 401) {
        localStorage.removeItem('goferbot_access_token')
        // 跳转登录页
      }
      throw error
    },
  },
})
```

### 8.2 API method 声明（推荐位置：`packages/web/api/methods/`）

```typescript
// packages/web/api/methods/knowledge-base.ts
import { api } from '../instance'

export const getKBList = (params: { page: number; pageSize: number }) =>
  api.Get('/kb', { params })

export const getKbDetail = (id: string) =>
  api.Get(`/kb/${id}`)

export const createKb = (data: CreateKbDTO) =>
  api.Post('/kb', data)

export const deleteKb = (id: string) =>
  api.Delete(`/kb/${id}`)
```

### 8.3 组件中使用

```tsx
// packages/web/routes/app/kb/index.tsx
import { useRequest } from 'alova/client'
import { getKBList } from '@/api/methods/knowledge-base'

function KBListPage() {
  const { data, loading, error } = useRequest(
    () => getKBList({ page: 1, pageSize: 20 }),
    { immediate: true }
  )

  if (loading) return <Skeleton />
  if (error)   return <ErrorAlert message={error.message} />
  return <KBList items={data?.items ?? []} />
}
```

### 8.4 与 TanStack Query 的分工

| 场景 | 推荐 |
|------|------|
| 页面主数据（列表/详情） | TanStack Query（缓存/去重/invalidation 更成熟） |
| 搜索/筛选实时请求 | alova useWatcher（防抖 + 竞态处理内置） |
| 分页列表 | alova usePagination 或 TanStack Query `useInfiniteQuery` |
| 表单提交 | alova useForm |
| 预加载/按需拉取 | alova useFetcher |
| 文件上传 | alova useUploader |
| SSE 流式 | alova useSSE |

> 两个库可共存：服务端状态缓存用 TanStack Query，交互密集的请求态管理用 alova。

---

## 9. 常见问题

### Q: useRequest 返回的 `data` 是什么类型？

`data` 的类型由 Method 的泛型和 `responded.onSuccess` 的返回值共同决定。推荐在 method 声明时指定泛型：

```typescript
interface UserDTO { id: number; name: string }

const getUser = (id: number) =>
  api.Get<UserDTO>(`/users/${id}`)
// data 推断为 UserDTO | undefined
```

### Q: 请求错误如何在组件中处理？

两种方式：

```tsx
// 方式 1：读取 error 状态
const { error } = useRequest(...)
if (error) return <ErrorView message={error.message} />

// 方式 2：onError 回调（适合 toast 提示）
const { onError } = useRequest(...)
onError(({ error }) => toast.error(error.message))
```

### Q: 如何防止 loading 闪烁（缓存命中时）？

alova 缓存命中时 `loading` 为 `false`，`data` 直接返回缓存值。若需要后台更新提示，检查 `event.fromCache`：

```tsx
const { onSuccess } = useRequest(...)
onSuccess((event) => {
  if (event.fromCache) {
    console.log('数据来自缓存，后台将更新')
  }
})
```

### Q: useWatcher 的 `watchingStates` 如何传入多个不同类型的 state？

```tsx
useWatcher(
  () => fetchData(name, age),
  [name, age],           // 支持任意类型组合
  { debounce: 300 }
)
```

### Q: 如何在组件外发起请求？

```tsx
import { createAlova } from 'alova'
import ReactHook from 'alova/react'

// alova 实例本身可以直接调用
const result = await api.Get('/users').send()
```

---

## 参考

- [AlovaJS 官方文档](https://alovajs.dev)
- [Alova GitHub](https://github.com/alovajs/alova)
- [AlovaJS 文档仓库](https://github.com/alovajs/alovajs.github.io)
- [v2 → v3 迁移指南](https://alovajs.dev/tutorial/project/migration/v2-to-v3)
