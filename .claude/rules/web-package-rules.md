---
name: web-package-rules
description: packages/web 强制约束 — 违反即不合规
globs:
  - "packages/web/**"
---

# packages/web 强制约束

> 违反以下任何一条 = 代码不合规，需退回修改。
> 详细示例和参考见 `packages/web/README.md`。

## 1. HTTP — 禁止 fetch

所有请求通过 `src/utils/server.ts` 的 `alovaInstance`，禁止原生 `fetch`。

```ts
import { alovaInstance } from '@/utils/server'
export const myApi = (id: string) => alovaInstance.Get<ResponseType>(`/path/${id}`)
```

## 2. 调用 API — 必须 .send()

API 函数返回 Method 对象，不是 Promise：

```ts
const data = await getSessions().send()   // 正确
const data = await getSessions()          // 错误
```

## 3. UI — 优先 shadcn/ui

1. 直接用 `src/components/ui/*` 已有组件
2. 不满足时以 shadcn 为基底二次开发
3. 不确定时调用 `shadcn` skill / MCP 查询，禁止凭记忆硬编码

## 4. 导入 — 禁止 barrel 文件

```ts
import { ChatInput } from '@/components/chat/ChatInput'   // 正确
import { ChatInput } from '@/components'                  // 错误
```

## 5. 架构 — Feature First

新增功能先判断属于哪个 feature（`kb/chat/file/auth`），在该 feature 目录内开发。
禁止直接创建新的全局 store / hook / util（全局仅限 `auth/theme/settings/tabs/app`）。

---

## 测试约束

- `vi.mock('@/api/xxx')` 放文件最顶部（import 之前）
- Mock 格式：`vi.fn(() => ({ send: vi.fn().mockResolvedValue(...) }))`
- 禁止使用 jest-dom matchers，只用 `toBeNull()` / `toEqual()` / `toBeDefined()` / `toHaveLength()`
