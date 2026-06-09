---
name: web-package-rules
description: packages/web/ 编码规范 — React + Zustand + alova 强制约束（稳定规则，不随代码演变）
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

---

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

### 3. Zustand Store — 两种模式

- **persist 模式**（auth/settings/tabs）：`create<T>()(persist(...))`，必须配置 `partialize`
- **plain 模式**（chat/kb/file）：`create<T>((set, get) => ...)`，无中间件
- 类型 interface 写在 store 文件中，不分离 types 文件
- 异步 action 标准模式：`set({ isLoading: true, error: null })` → try/catch → `set({ data, isLoading: false })`

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

### 6. 页面组件拆分 — 路由文件 + 同名目录

TanStack Start 采用文件系统路由：`routes/app/kb.tsx` 对应路径 `/app/kb`。

页面私有组件（仅当前页面使用的业务块）存放于**同名目录**下：

```
src/routes/app/
├── kb.tsx              # 路由入口 — 只负责数据获取、全局状态连接、布局编排
└── kb/
    ├── Sidebar.tsx     # 页面私有组件 — 侧边栏交互逻辑
    ├── Header.tsx      # 页面私有组件 — 头部展示
    └── Main.tsx        # 页面私有组件 — 文件区域状态与交互
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

---

## 测试约束

### Mock 模式

- `vi.mock('@/api/xxx')` 必须放在文件**最顶部**（import 之前），vitest 会自动 hoist
- 每个 API 函数 mock 为 `vi.fn(() => ({ send: vi.fn().mockResolvedValue(...) }))`
- **禁止**使用 jest-dom matchers（`toBeInTheDocument` 等，项目未安装），只用 `toBeNull()` / `toEqual()` / `toBeDefined()` / `toHaveLength()`

### Store 重置策略

| Store 类型                    | 重置方式                                                                                             |
|-------------------------------|------------------------------------------------------------------------------------------------------|
| plain（chat/kb/file）         | `useStore.setState(useStore.getInitialState())`                                                      |
| persist（auth/settings/tabs） | `vi.resetModules()` + `await import('@/stores/xxx')` — 必须重新加载模块以击败 persist hydration 缓存 |

组件测试中，在 render 前直接 `useStore.setState({ ... })` 设置所需状态。

---

## 文档索引

本文件只含稳定不变的核心约束。以下内容在 README 中持续更新，规则文件不做同步：

| 需要了解                                        | README 章节                  |
|-------------------------------------------------|------------------------------|
| 完整目录结构（每个文件的职责）                  | §目录结构                    |
| 架构数据流（单向流 + alovaInstance 能力）       | §架构数据流                  |
| 已有 API 方法完整清单（24 个方法）              | §强制规则 > 优先复用已有封装 |
| 已有 Store 字段/actions 速查表                  | §已有 Store 速查             |
| 已有 Util 工具导出清单                          | §强制规则 > 优先复用已有封装 |
| 测试代码示例（API mock / persist reset / 组件） | §测试规范                    |
| Agent 开发前逐项检查清单                        | §Agent 开发检查清单          |
