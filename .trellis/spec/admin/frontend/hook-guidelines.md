# Hook 指南

> 本项目中 hooks 的使用方式。

---

## 概述

Admin 前端使用 **alova** 作为 HTTP 客户端和数据获取方案，配合自定义 Hook `useQueryWithRetry` 实现统一的 Loading/Error/Retry 三态数据查询模式。全局状态使用 **Zustand**。

---

## 自定义 Hook 模式

### 基础结构

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'

export function useCustomHook(initialValue?: T): ReturnType {
  const [state, setState] = useState<T>(initialValue)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const update = useCallback((value: T) => {
    if (mountedRef.current) {
      setState(value)
    }
  }, [])

  return { state, update }
}
```

### useQueryWithRetry（核心 Hook）

项目提供的统一数据查询 Hook，封装了 Loading/Error/Retry 三态：

```tsx
export interface UseQueryWithRetryState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export interface UseQueryWithRetryResult<T> extends UseQueryWithRetryState<T> {
  run: () => Promise<void>
  reset: () => void
}

export function useQueryWithRetry<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  immediate = true,
): UseQueryWithRetryResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcherRef.current()
      if (mountedRef.current) {
        setData(result)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(mapErrorMessage(err))
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    if (immediate) {
      void run()
    }
    return () => {
      mountedRef.current = false
    }
  }, deps)

  return { data, loading, error, run, reset }
}
```

### 使用示例

```tsx
import { useQueryWithRetry } from '@/hooks/useQueryWithRetry'
import { fetchUsers } from '../services'

export function UserList() {
  const { data, loading, error, run } = useQueryWithRetry(
    () => fetchUsers({ page: 1, pageSize: 10 }),
    [],
    true
  )

  if (loading) return <Spin />
  if (error) return <Alert message={error} type="error" action={<Button onClick={run}>重试</Button>} />

  return <UserTable data={data?.items ?? []} />
}
```

---

## 数据获取

### alova HTTP 客户端

Admin 前端使用 alova 作为 HTTP 客户端，配置了自动 Token 刷新：

```tsx
import { createAlova } from 'alova'
import adapterFetch from 'alova/fetch'
import ReactHook from 'alova/react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export const alovaInstance = createAlova({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  shareRequest: true,
  requestAdapter: adapterFetch({
    customFetch: (input, init) => fetch(input, { ...init, credentials: 'include' }),
  }),
  responded: {
    onSuccess(response, method) {
      if (isUnauthorized(response.status)) {
        return doRefreshAndRetry(method)
      }
      return response.json().then((json) => json.data ?? json)
    },
    onError(error, method) {
      if (isUnauthorized(error.status)) {
        return doRefreshAndRetry(method)
      }
      throw error
    },
  },
})
```

### API 封装模式

在 `api/` 目录下按资源分组封装 API：

```tsx
import { alovaInstance } from '@/utils/server'
import type { AdminUser, AdminUserListQuery, AdminUserListResponse } from '@goferbot/data'

export const listUsers = (query: AdminUserListQuery) =>
  alovaInstance.Get<AdminUserListResponse>('/admin/users', { params: query })

export const createUser = (data: CreateAdminUserRequest) =>
  alovaInstance.Post<AdminUser>('/admin/users', data)

export const updateUser = (id: string, data: UpdateAdminUserRequest) =>
  alovaInstance.Patch<AdminUser>(`/admin/users/${id}`, data)

export const deleteUser = (id: string) =>
  alovaInstance.Delete<{ success: boolean }>(`/admin/users/${id}`)
```

### Services 层封装

在 `features/module-name/services.ts` 中封装业务逻辑：

```tsx
import { toast } from 'sonner'
import { listUsers as listUsersApi } from '@/api/admin'
import { mapErrorMessage } from '@/utils/error-mapper'

export async function fetchUsers(query: ListUsersQuery): Promise<PagedResponse<AdminUserResponse>> {
  try {
    return await listUsersApi(query).send()
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    throw err
  }
}

export async function deleteUserService(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteUserApi(id).send()
    toast.success('用户已删除')
    return { success: true }
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return { success: false, error: msg }
  }
}
```

---

## 命名约定

| 类型 | 规则 | 示例 |
|------|------|------|
| Hook | `use` 前缀 + 驼峰命名 | `useQueryWithRetry`, `useAuth` |
| API 函数 | 动词 + 名词 | `listUsers`, `createUser`, `getUser` |
| Services 函数 | 业务语义命名 | `fetchUsers`, `deleteUserService`, `toggleUserStatus` |
| 状态变量 | 驼峰命名 | `data`, `loading`, `error`, `users` |

---

## 常见错误

| 错误模式 | 正确做法 |
|----------|----------|
| 在组件内直接调用 `alovaInstance.Get().send()` | 通过 `api/` 封装，再通过 `services.ts` 调用 |
| 忽略错误处理 | 使用 `try-catch` + `toast` 或 `error-mapper` |
| 未处理竞态条件 | 使用 `mountedRef` 或 `useQueryWithRetry` |
| Hook 命名不规范 | 所有自定义 Hook 必须以 `use` 开头 |
| 在 useEffect 依赖数组中包含动态对象 | 使用 `useMemo` 或 `useRef` 稳定引用 |