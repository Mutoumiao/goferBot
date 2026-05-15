# Ollama 本地模型与全局错误处理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Ollama 本地模型调用、全局错误处理与展示、AI 思考 Loading 状态、空状态引导和输入框禁用状态。

**Architecture:** Sidecar `llm.ts` 增加 Ollama OpenAI 兼容调用（无 API Key），`chat.ts` 统一错误分类并 SSE 输出。前端消息流增加错误卡片和 Loading 指示器。`sidecarClient` 提供 sidecar 就绪检查，输入框绑定禁用逻辑。

**Tech Stack:** Vue 3 + Pinia + Hono + better-sqlite3 + SSE

---

## File Structure

| 文件 | 职责 |
|------|------|
| `server/src/services/llm.ts` | 修改：`streamChatCompletion` 支持 Ollama（无 API Key，使用 baseUrl） |
| `server/src/routes/chat.ts` | 修改：错误分类（API/网络/sidecar），SSE `error` 事件携带类型 |
| `src/utils/sidecarClient.ts` | 修改：新增 `isSidecarReady()` 辅助函数 |
| `src/stores/session.ts` | 修改：`sendMessage` 增加预检，新增 `sendErrorType` 用于区分错误类型 |
| `src/components/ChatMessage.vue` 或新建 `ChatErrorCard.vue` | 新增：消息流中的错误卡片组件 |
| `src/components/ChatLoading.vue` | 新增：AI 思考中 Loading 指示器组件 |
| `src/components/ChatInput.vue` | 修改：绑定 `disabled`（sidecar 未就绪 / LLM 未配置 / 发送中） |
| `src/components/EmptySession.vue` | 修改：空会话首页引导（已有快捷胶囊，增强文案） |
| `src/components/KnowledgeBasePage.vue` | 修改：空知识库状态引导 |
| `src/components/HistoryPage.vue` | 修改：空历史状态引导 |
| `src/App.vue` | 修改：可选全局 Toast 容器 |
| `src/types/index.ts` | 修改：新增 `ChatErrorType` 类型 |

---

### Task 1: Sidecar LLM 服务支持 Ollama 调用

**Files:**
- Modify: `server/src/services/llm.ts`
- Test: `tests/unit/server/ollama.test.ts`（新建）

- [ ] **Step 1: 修改 `streamChatCompletion` 支持 Ollama**

Ollama 使用 OpenAI 兼容 API，但不需要 API Key。当 `provider === 'ollama'` 时不应发送 `Authorization` header。

```typescript
export async function streamChatCompletion(
  messages: Array<{ role: string; content: string }>,
  config: LLMConfig,
  onChunk: (content: string) => void | Promise<void>,
  systemPrompt?: string
): Promise<void> {
  const url = config.baseUrl || getDefaultBaseUrl(config.provider)
  if (!url) {
    throw new Error(`Unknown provider: ${config.provider}`)
  }

  const apiMessages: Array<{ role: string; content: string }> = []
  if (systemPrompt) {
    apiMessages.push({ role: 'system', content: systemPrompt })
  }
  apiMessages.push(...messages)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (config.provider !== 'ollama') {
    headers['Authorization'] = `Bearer ${config.apiKey}`
  }

  const response = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: apiMessages,
      stream: true,
    }),
  })

  if (!response.ok) {
    const error = await response.text().catch(() => 'Unknown error')
    throw new Error(`LLM API error: ${response.status} ${error}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim() || !line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content
        if (content) {
          await onChunk(content)
        }
      } catch {
        // ignore parse errors
      }
    }
  }
}
```

- [ ] **Step 2: 运行现有 LLM 测试确认无回归**

Run: `pnpm test -- tests/unit/server/llm.test.ts`
Expected: 全部通过（若不存在该测试文件则跳过）

- [ ] **Step 3: 提交**

```bash
git add server/src/services/llm.ts
git commit -m "feat(#07): sidecar llm 服务支持 Ollama 无密钥调用"
```

---

### Task 2: Chat 路由统一错误分类与 SSE 输出

**Files:**
- Modify: `server/src/routes/chat.ts`
- Test: `tests/unit/server/chat.test.ts`（扩展，若存在）

- [ ] **Step 1: 在 `chat.ts` 中增加错误分类逻辑**

将错误分为 `api_error`（4xx/5xx）、`network_error`（fetch 失败）、`sidecar_error`（其他），通过 SSE `error` 事件输出 JSON `{ type, message }`。

修改 `streamSSE` 回调中的 `catch` 块：

```typescript
    } catch (err) {
      let errorType = 'unknown'
      let message = err instanceof Error ? err.message : 'Stream error'

      if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
        errorType = 'network_error'
      } else if (message.includes('LLM API error')) {
        errorType = 'api_error'
      }

      await stream.writeSSE({ event: 'error', data: JSON.stringify({ type: errorType, message }) })
    } finally {
      await stream.close()
    }
```

- [ ] **Step 2: 运行 chat 相关测试确认无回归**

Run: `pnpm test -- tests/unit/server/chat.test.ts` 或 `pnpm test`
Expected: 全部通过

- [ ] **Step 3: 提交**

```bash
git add server/src/routes/chat.ts
git commit -m "feat(#07): chat 路由统一错误分类并 SSE 输出错误类型"
```

---

### Task 3: 前端类型定义 — 新增 ChatErrorType

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 在 `src/types/index.ts` 中增加 `ChatErrorType`**

```typescript
export type ChatErrorType = 'api_error' | 'network_error' | 'sidecar_error' | 'unknown'
```

同时在 `Message` 类型附近或独立位置定义错误消息结构（用于消息流中的错误卡片）：

```typescript
export interface ChatErrorMessage {
  id: string
  session_id: string
  role: 'error'
  content: string
  errorType: ChatErrorType
  created_at: number
}
```

- [ ] **Step 2: 提交**

```bash
git add src/types/index.ts
git commit -m "feat(#07): 新增 ChatErrorType 与 ChatErrorMessage 类型"
```

---

### Task 4: sidecarClient 增加就绪检查

**Files:**
- Modify: `src/utils/sidecarClient.ts`
- Test: `tests/unit/utils/sidecarClient.test.ts`（扩展，若存在）

- [ ] **Step 1: 新增 `isSidecarReady()`**

```typescript
export async function isSidecarReady(): Promise<boolean> {
  return healthCheck()
}
```

已有 `healthCheck()` 函数，可直接复用。此步主要为暴露一个语义化的 API 供组件使用。

- [ ] **Step 2: 提交**

```bash
git add src/utils/sidecarClient.ts
git commit -m "feat(#07): sidecarClient 暴露 isSidecarReady 辅助函数"
```

---

### Task 5: Session Store 增强错误处理与预检

**Files:**
- Modify: `src/stores/session.ts`

- [ ] **Step 1: 新增 `sendErrorType` ref**

在 `sendError` 旁边增加：

```typescript
const sendErrorType = ref<ChatErrorType | null>(null)
```

- [ ] **Step 2: 修改 `sendMessage` 增加预检和错误类型解析**

在 `sendMessage` 开头增加 LLM 配置预检：

```typescript
  async function sendMessage(content: string, config: LLMConfig, knowledgeBaseIds?: string[]) {
    sendError.value = null
    sendErrorType.value = null
    isSending.value = true

    // Pre-check: sidecar ready
    const ready = await isSidecarReady()
    if (!ready) {
      sendError.value = 'Sidecar 服务未就绪，请检查服务状态'
      sendErrorType.value = 'sidecar_error'
      isSending.value = false
      return
    }

    // Pre-check: valid LLM config
    if (!config.provider || !config.model) {
      sendError.value = '未配置 LLM 模型，请前往设置页配置'
      sendErrorType.value = 'unknown'
      isSending.value = false
      return
    }
```

在 SSE 读取循环中解析 error 事件：

找到这段代码：
```typescript
      if (!response.ok) {
        const errText = await response.text().catch(() => '请求失败')
        throw new Error(errText)
      }
```

替换为：
```typescript
      if (!response.ok) {
        const errText = await response.text().catch(() => '请求失败')
        sendErrorType.value = 'api_error'
        throw new Error(errText)
      }
```

在 catch 块中：
```typescript
    } catch (e) {
      sendError.value = e instanceof Error ? e.message : String(e)
      if (!sendErrorType.value) {
        sendErrorType.value = 'network_error'
      }
    } finally {
      isSending.value = false
    }
```

- [ ] **Step 3: 将 `sendErrorType` 加入 return 对象**

```typescript
  return {
    ...
    sendErrorType,
    ...
  }
```

- [ ] **Step 4: 提交**

```bash
git add src/stores/session.ts
git commit -m "feat(#07): session store 增加 LLM 预检与错误类型分类"
```

---

### Task 6: ChatErrorCard 组件 — 消息流中的错误卡片

**Files:**
- Create: `src/components/ChatErrorCard.vue`
- Modify: `src/components/ChatMessage.vue` 或消息渲染处（若有）

- [ ] **Step 1: 新建 `ChatErrorCard.vue`**

```vue
<script setup lang="ts">
import type { ChatErrorType } from '@/types'

const props = defineProps<{
  message: string
  errorType: ChatErrorType
}>()

const emit = defineEmits<{
  retry: []
}>()

const typeLabels: Record<ChatErrorType, string> = {
  api_error: 'API 错误',
  network_error: '网络错误',
  sidecar_error: '服务错误',
  unknown: '未知错误',
}
</script>

<template>
  <div class="my-3 flex items-start gap-3 rounded-xl border border-danger-500/30 bg-danger-500/10 p-4">
    <span class="i-mdi-alert-circle text-lg text-danger-400" />
    <div class="flex-1">
      <p class="text-sm font-medium text-danger-400">{{ typeLabels[errorType] || '错误' }}</p>
      <p class="mt-1 text-sm text-text-secondary">{{ message }}</p>
      <button
        class="mt-2 rounded-md bg-danger-500 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-danger-400"
        @click="emit('retry')"
      >
        重试
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 在消息列表渲染中使用 `ChatErrorCard`**

找到渲染消息列表的组件（如 `ChatPage.vue` 或 `ChatSession.vue`），在 `v-for` 中增加对 `role === 'error'` 的渲染：

```vue
<ChatErrorCard
  v-else-if="msg.role === 'error'"
  :message="msg.content"
  :error-type="msg.errorType"
  @retry="retryLastMessage"
/>
```

- [ ] **Step 3: 提交**

```bash
git add src/components/ChatErrorCard.vue
git commit -m "feat(#07): ChatErrorCard 错误卡片组件"
```

---

### Task 7: ChatLoading 组件 — AI 思考中指示器

**Files:**
- Create: `src/components/ChatLoading.vue`

- [ ] **Step 1: 新建 `ChatLoading.vue`**

```vue
<script setup lang="ts">
// No props needed
</script>

<template>
  <div class="my-2 flex items-center gap-2 text-sm text-text-tertiary">
    <span class="i-mdi-loading animate-spin text-base" />
    <span>思考中...</span>
  </div>
</template>
```

- [ ] **Step 2: 在消息列表底部条件渲染**

在消息列表组件中，当 `store.isSending` 为 true 且最后一条消息是 `user` 时渲染：

```vue
<ChatLoading v-if="store.isSending && activeMessages.length > 0 && activeMessages[activeMessages.length - 1].role === 'user'" />
```

- [ ] **Step 3: 提交**

```bash
git add src/components/ChatLoading.vue
git commit -m "feat(#07): ChatLoading AI 思考中指示器"
```

---

### Task 8: ChatInput 绑定禁用状态

**Files:**
- Modify: `src/components/ChatInput.vue`（或当前项目中的输入框组件）

- [ ] **Step 1: 确定输入框组件位置**

通过 `grep -r "sendMessage" src/components/` 或 `grep -r "ChatInput" src/` 找到实际组件路径。假设为 `src/components/ChatInput.vue`。

- [ ] **Step 2: 修改输入框绑定 `disabled`**

```vue
<script setup lang="ts">
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import { computed } from 'vue'

const sessionStore = useSessionStore()
const settingsStore = useSettingsStore()

const isDisabled = computed(() => {
  return sessionStore.isSending || !settingsStore.getLLMConfig()
})
</script>

<template>
  <div class="...">
    <input
      v-model="inputText"
      :disabled="isDisabled"
      class="... disabled:cursor-not-allowed disabled:opacity-50"
      placeholder="输入消息..."
      @keydown.enter="handleSend"
    />
    <button
      :disabled="isDisabled || !inputText.trim()"
      class="... disabled:cursor-not-allowed disabled:opacity-50"
      @click="handleSend"
    >
      发送
    </button>
  </div>
</template>
```

- [ ] **Step 3: 提交**

```bash
git add src/components/ChatInput.vue
git commit -m "feat(#07): 输入框绑定禁用状态（未配置模型 / 发送中）"
```

---

### Task 9: 空状态引导增强

**Files:**
- Modify: `src/components/EmptySession.vue`
- Modify: `src/components/KnowledgeBasePage.vue`
- Modify: `src/components/HistoryPage.vue`

- [ ] **Step 1: `EmptySession.vue` — 空会话首页**

确认已有快捷提问胶囊，若缺少引导文案则补充：

```vue
<p class="mt-2 text-sm text-text-tertiary">选择一个快捷问题开始对话，或直接输入你的问题</p>
```

- [ ] **Step 2: `KnowledgeBasePage.vue` — 空知识库状态**

在知识库列表为空时显示：

```vue
<div v-if="knowledgeBases.length === 0" class="flex flex-col items-center justify-center py-20">
  <span class="i-mdi-book-open-outline text-4xl text-text-tertiary" />
  <p class="mt-4 text-text-secondary">暂无知识库</p>
  <p class="mt-1 text-xs text-text-tertiary">点击"添加文件"导入文档</p>
</div>
```

- [ ] **Step 3: `HistoryPage.vue` — 空历史状态**

已有空状态，确认文案为：

```
暂无对话历史
开始一段新对话，历史将出现在这里
```

若文案已符合则跳过。

- [ ] **Step 4: 提交**

```bash
git add src/components/EmptySession.vue src/components/KnowledgeBasePage.vue src/components/HistoryPage.vue
git commit -m "feat(#07): 空状态引导文案增强"
```

---

### Task 10: 全局 Toast 错误提示（可选增强）

**Files:**
- Create: `src/components/GlobalToast.vue`
- Modify: `src/App.vue`
- Modify: `src/stores/session.ts`

- [ ] **Step 1: 新建 `GlobalToast.vue`**

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSessionStore } from '@/stores/session'

const store = useSessionStore()
const visible = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

watch(() => store.sendError, (err) => {
  if (err) {
    visible.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { visible.value = false }, 5000)
  }
})

function dismiss() {
  visible.value = false
  if (timer) clearTimeout(timer)
}
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300"
    enter-from-class="opacity-0 translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-200"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-2"
  >
    <div
      v-if="visible && store.sendError"
      class="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-surface-3 px-4 py-2.5 text-sm text-text-primary shadow-xl"
    >
      <span class="i-mdi-alert-circle text-danger-400" />
      <span>{{ store.sendError }}</span>
      <button class="ml-2 text-text-tertiary hover:text-text-primary" @click="dismiss">
        <span class="i-mdi-close text-xs" />
      </button>
    </div>
  </Transition>
</template>
```

- [ ] **Step 2: 在 `App.vue` 中引入**

```vue
<GlobalToast />
```

- [ ] **Step 3: 提交**

```bash
git add src/components/GlobalToast.vue src/App.vue
git commit -m "feat(#07): 全局 Toast 错误提示"
```

---

## Self-Review

**1. Spec coverage:**

| 验收标准 | 对应 Task |
|----------|-----------|
| Sidecar 支持 Ollama 调用 | Task 1 |
| Ollama SSE 流式响应兼容 | Task 1 + Task 2 |
| 设置页 Ollama 配置 | #05 已完成，无需修改 |
| 全局错误处理 | Task 2 + Task 5 |
| 错误展示（错误卡片 / toast） | Task 6 + Task 10 |
| AI 思考 Loading 状态 | Task 7 |
| 空状态引导 | Task 9 |
| 输入框禁用状态 | Task 8 |

**2. Placeholder scan:**
- 无 "TBD"、"TODO"、"implement later"
- 所有步骤包含实际代码或确切命令
- 无 "Similar to Task N"

**3. Type consistency:**
- `ChatErrorType` 在 `src/types/index.ts` 定义，在 `session.ts` 和 `ChatErrorCard.vue` 中使用
- `isSidecarReady` 在 `sidecarClient.ts` 定义，在 `session.ts` 中使用

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-11-ollama-error-handling.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
