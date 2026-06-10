---
name: web-package-rules
description: packages/web/ 约束规范 — React + Zustand + alova 强制约束（稳定规则，不随代码演变）
globs:
  - "packages/web/**"
---

# packages/web 编码规范

> 本文件仅含**稳定不变**的核心约束。开发前必须先阅读 `packages/web/README.md`（5 分钟），
> 获取最新的目录结构、已有封装清单、代码示例。

## 首次开发

编辑 `packages/web/` 下任何文件前，打开 `packages/web/README.md`，确认：

- 需要的新功能是否已有 API/Store/Util 封装
- 是否遵守了所有强制规则
- 组件满足高内聚低耦合原则

***

## 核心约束

### 1. HTTP 请求 — 禁止原生 fetch

所有 HTTP 请求必须通过 `src/api/*.ts` 的 alova Method 发送，**禁止**在组件/store 中直接写 `fetch()`。

`alovaInstance`（`src/utils/server.ts`）已预配置：

- `baseURL: '/api'` + `Authorization` 头自动注入
- 401 自动刷新 token（失败则跳 `/login`）
- 响应 `{ data: T }` 自动解包，业务代码直接拿到 `T`

新建 API 方法时，从 `@/utils/server` 导入 `alovaInstance`：

```typescript
import { alovaInstance } from '@/utils/server'
export const myApi = (id: string) => alovaInstance.Get<ResponseType>(`/path/${id}`)
```

### 2. alova Method 调用 — 必须 .send()

所有 API 函数返回的是 Method 对象（不是 Promise），调用方必须 `.send()`：

```typescript
const data = await getSessions().send()   // 正确
const data = await getSessions()          // 错误 — 返回 Method 对象，不是数据
```

### 4. UI 组件 — 优先使用 shadcn/ui

本项目底层 UI 基于 **shadcn/ui**。开发页面时：

1. **优先直接使用** `src/components/ui/` 下已有的 shadcn 组件
2. **无法满足需求时**，以 shadcn/ui 组件为基底进行二次开发（扩展样式或组合封装），保持视觉和交互一致性
3. **不确定 shadcn 是否有对应组件或用法时**，调用 `shadcn` skill 或 `shadcn` MCP 查询/安装，禁止凭记忆硬编码替代方案

```typescript
import { Button } from '@/components/ui/button'   // 正确 — 直接引用 shadcn 组件
import { Dialog, DialogContent } from '@/components/ui/dialog'
```

### 5. 组件 — 禁止 barrel 文件

```typescript
import { ChatInput } from '@/components/chat/ChatInput'   // 正确 — 直接路径
import { ChatInput } from '@/components'                  // 错误 — 不存在 barrel
```

**原则**：

- 路由文件（`kb.tsx`）只做**数据中转** — 请求接口、处理数据、通过 props 传递给子组件
- 子组件（`kb/*.tsx`）管理**自身状态** — viewMode、sortBy、filterType、局部 UI 状态等
- 禁止将所有状态和回调都堆在路由文件中传递 — 属于哪个组件的职责就放在哪个组件里

### 6. 优先复用已有工具

`src/utils/` 下的封装是纯函数/基础设施，开发前先检查是否已存在：

| 文件                  | 用途                                                                |
|-----------------------|---------------------------------------------------------------------|
| `utils/server.ts`     | `alovaInstance` — HTTP 客户端（建新 API 必用）                      |
| `utils/llm-config.ts` | `getLLMConfig()` / `mergeAppConfig()` / `DEFAULT_CONFIG` — LLM 配置 |
| `utils/sse-parser.ts` | `parseSSEChunk()` — SSE 流式解析                                    |
| `lib/utils.ts`        | `cn()` — class 合并                                                 |

```typescript
// 示例：组件中获取 LLM 配置（非硬编码）
import { useSettingsStore } from '@/stores/settings'
import { getLLMConfig, type LLMConfig } from '@/utils/llm-config'
const config = useSettingsStore((s) => s.config)
const llm = getLLMConfig(config) ?? fallback
```

***

## 测试约束

### Mock 模式

- `vi.mock('@/api/xxx')` 必须放在文件**最顶部**（import 之前），vitest 会自动 hoist
- 每个 API 函数 mock 为 `vi.fn(() => ({ send: vi.fn().mockResolvedValue(...) }))`
- **禁止**使用 jest-dom matchers（`toBeInTheDocument` 等，项目未安装），只用 `toBeNull()` / `toEqual()` / `toBeDefined()` / `toHaveLength()`

