# 代码质量指南

> 本项目的代码标准和禁止模式。

---

## 概述

项目使用 **Biome** 进行代码规范检查和格式化。所有代码必须通过 `pnpm lint` 和 `pnpm typecheck` 检查。

---

## 代码规范

### 代码格式化

项目使用 Biome 进行代码格式化，自动处理缩进、换行和空格：

```bash
# 格式化所有文件
pnpm format

# 检查格式问题（不自动修复）
pnpm lint
```

### 代码风格规则

| 规则 | 说明 | 示例 |
|------|------|------|
| **缩进** | 使用 2 空格缩进 | ✅ `if (true) {` |
| **分号** | 语句末尾必须加分号 | ✅ `const x = 1;` |
| **引号** | 优先使用单引号 | ✅ `'hello'` |
| **花括号** | 单行语句也需要花括号 | ✅ `if (x) { return; }` |
| **箭头函数** | 单行箭头函数使用括号 | ✅ `(x) => x * 2` |

### 文件头注释

不需要为每个文件添加文件头注释。

### 函数注释

复杂函数使用 JSDoc 注释：

```tsx
/**
 * 加载聊天会话列表
 * @returns {Promise<void>}
 */
export async function loadChatSessions() {
  // ...
}
```

简单函数不需要注释，代码本身应该自解释。

---

## 禁止模式

### 禁止的代码模式

| 禁止 | 描述 | 正确做法 |
|------|------|----------|
| `any` 类型 | 使用 `any` 绕过类型检查 | 使用明确的类型或 `unknown` |
| `console.log` | 生产代码中的调试日志 | 使用 `console.debug` 或移除 |
| 内联 `style={{}}` | 使用内联样式 | 使用 Tailwind 类名 |
| 直接修改 shadcn/ui 组件 | 修改 `components/ui/*.tsx` | 创建 wrapper 组件 |
| `document.querySelector` | 使用原生 DOM 查询 | 使用 React refs |
| `setTimeout` 无清除 | 未清除的定时器 | 使用 `useEffect` 清理 |
| 硬编码 API 地址 | `fetch('/api/data')` | 使用 alova 实例 |
| 密码明文存储 | `localStorage.setItem('password', pwd)` | 密码由后端管理 |

### 禁止的设计模式

| 禁止 | 描述 | 正确做法 |
|------|------|----------|
| 组件直接调用 API | 在组件中使用 `fetch` | 通过 alova `useRequest` |
| Store 中包含业务逻辑 | 在 store 中处理 API 调用 | 业务逻辑放在 `services.ts` |
| 大型组件 | 超过 200 行的组件 | 拆分为多个子组件 |
| 重复代码 | 相同逻辑出现在多个地方 | 提取为工具函数或 Hook |
| 魔法字符串 | 硬编码的字符串值 | 使用常量或枚举 |

---

## 性能优化

### 避免不必要的重渲染

使用 Zustand 选择器和 `React.memo`：

```tsx
// ✅ 使用选择器
const userName = useAuthStore((state) => state.user?.name)

// ✅ 使用 React.memo
const MemoizedComponent = React.memo(function MyComponent({ data }) {
  return <div>{data}</div>
})
```

### 列表渲染优化

为列表项提供稳定的 `key`：

```tsx
// ✅ 使用稳定的 key
{sessions.map((session) => (
  <SessionItem key={session.id} session={session} />
))}

// ❌ 错误：使用数组索引
{sessions.map((session, index) => (
  <SessionItem key={index} session={session} />
))}
```

### 延迟加载

使用 `React.lazy` 和 `Suspense` 进行代码分割：

```tsx
const ChatPage = React.lazy(() => import('./ChatPage'))

<Suspense fallback={<Spinner />}>
  <ChatPage />
</Suspense>
```

---

## 错误处理

### 全局错误处理

alova 实例配置了全局错误处理：

```tsx
const responded = {
  onSuccess(response, method) {
    if (!response.ok) {
      return response.json().then((json) => {
        const message = json.error?.message || `HTTP ${response.status}`
        throw new Error(message)
      })
    }
    return response.json().then((json) => json.data ?? json)
  },
  onError(error, method) {
    if (error.status === 401 || error.status === 403) {
      return doRefreshAndRetry(method)
    }
    throw error
  },
}
```

### 组件错误处理

使用 `ErrorBoundary` 捕获组件错误：

```tsx
class ErrorBoundary extends React.Component<{ fallback: ReactNode; children: ReactNode }> {
  state = { hasError: false }
  
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}
```

### 用户友好的错误消息

错误消息应该清晰、友好，避免技术术语：

```tsx
// ✅ 友好的错误消息
setError('加载会话失败，请稍后重试')

// ❌ 技术错误消息
setError('HTTP 500: Internal Server Error')
```

---

## 安全

### XSS 防护

1. **React 自动转义**：React 默认转义所有文本内容
2. **禁止 `dangerouslySetInnerHTML`**：除非必要，否则不使用
3. **安全的 HTML 渲染**：如果必须渲染 HTML，使用 DOMPurify 清理

### 认证安全

1. **HttpOnly Cookie**：认证 token 存储在 HttpOnly Cookie 中
2. **禁止 localStorage token**：不将 token 存储在 localStorage
3. **安全的重定向**：使用 `router.navigate` 而非 `window.location.href`

### CSP（内容安全策略）

项目配置了 CSP，禁止内联脚本和样式：

```tsx
// ❌ 禁止：内联样式
<div style={{ color: 'red' }} />

// ✅ 正确：使用 Tailwind
<div className="text-red-500" />
```

---

## 测试

### 测试框架

项目使用 **Vitest** 进行单元测试：

```bash
# 运行所有测试
pnpm test

# 运行特定测试文件
pnpm test -- chat/hooks.test.ts
```

### 测试覆盖率

目标覆盖率：
- 核心功能：80%+
- 工具函数：100%
- UI 组件：50%+（重点测试关键交互逻辑）

### 测试模式

```tsx
import { describe, it, expect } from 'vitest'
import { useChatHistory } from './hooks'

describe('useChatHistory', () => {
  it('should load sessions', async () => {
    const { sessions, loading, reload } = useChatHistory(1, 20)
    
    expect(loading).toBe(true)
    await reload()
    expect(sessions).toBeDefined()
  })
})
```

---

## 代码审查清单

### PR 审查检查项

| 检查项 | 说明 |
|--------|------|
| ✅ 类型安全 | 无 `any` 类型，类型定义完整 |
| ✅ 代码格式化 | 通过 Biome 检查 |
| ✅ 测试覆盖 | 新增功能有对应的测试 |
| ✅ 错误处理 | 异常情况有处理 |
| ✅ 性能 | 无明显性能问题 |
| ✅ 安全 | 无 XSS、CSRF 风险 |
| ✅ 文档 | 新增功能有文档说明 |

### 代码度量

| 指标 | 阈值 | 说明 |
|------|------|------|
| 文件长度 | ≤ 400 行 | 过长的文件需要拆分 |
| 函数长度 | ≤ 50 行 | 过长的函数需要拆分 |
| 组件复杂度 | ≤ 10 | 使用 `react-complexity-report` 检查 |

---

## 代码引用

| 规范 | 参考文件 |
|------|----------|
| Biome 配置 | `biome.json` |
| alova 错误处理 | `packages/web/src/utils/server.ts` |
| 工具函数 | `packages/web/src/lib/utils.ts` |
| 测试示例 | `packages/web/src/features/chat/hooks.ts` |