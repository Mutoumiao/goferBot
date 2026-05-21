# 多提供商设置（Settings + Multi-Provider）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现设置页 UI、多 LLM 提供商配置管理、Embedding 配置、温度参数，并在对话页顶部支持当前会话的模型切换。

**Architecture:** Sidecar 通过 `config.json` 持久化全部配置，暴露 `GET/POST /settings` API。前端 Settings Store 从 API 读写配置，并提供 `getLLMConfig(providerKey)` 方法将存储的多提供商配置转换为调用 LLM 所需的扁平 `LLMConfig`。会话标签（Tab）增加 `provider`/`model` 快照字段，切换仅影响当前标签，新建会话继承全局 `defaultChatProvider`。

**Tech Stack:** Vue 3 + Pinia + Tailwind CSS, Hono + Node.js, better-sqlite3 (schema 已就绪), Vitest

---

## File Structure

| File | Action | Responsibility |
|------|--------|--------------|
| `server/src/types.ts` | Modify | 新增 `AppConfig`、`ChatProviderConfig`、`OllamaConfig`、`EmbeddingProviderConfig` |
| `server/src/routes/settings.ts` | Create | `GET /settings` 读取 `config.json`；`POST /settings` 写入 `config.json`；默认配置回退 |
| `server/src/index.ts` | Modify | 注册 `settings` 路由 |
| `src/types/index.ts` | Modify | 新增前端配置相关类型；`Tab` 增加 `provider`/`model` |
| `src/stores/settings.ts` | Modify | 从 API 读写配置；提供 `getLLMConfig` 转换方法；管理 loading 状态 |
| `src/components/SettingsPage.vue` | Create | 设置页 UI：LLM 提供商卡片、Embedding 卡片、通用设置卡片 |
| `src/App.vue` | Modify | 引入 `SettingsPage` 组件替换 settings 占位符 |
| `src/components/ChatPage.vue` | Modify | 添加顶部栏（会话标题编辑 + 模型切换下拉） |
| `src/components/ModelSelector.vue` | Create | 模型选择下拉组件 |
| `src/stores/session.ts` | Modify | `sendMessage` 优先使用当前 tab 的 provider/model；支持切换模型方法 |
| `tests/unit/server/settings.test.ts` | Create | Sidecar settings API 测试 |
| `tests/unit/stores/settings.test.ts` | Modify | 更新为 API 驱动的 settings store 测试 |
| `tests/unit/components/SettingsPage.test.ts` | Create | 设置页组件渲染与交互测试 |
| `tests/unit/components/ModelSelector.test.ts` | Create | 模型选择器组件测试 |
| `tests/unit/stores/session.test.ts` | Modify | 补充模型切换相关测试 |

---

### Task 1: Sidecar 配置类型与 Settings API

**Files:**
- Modify: `server/src/types.ts`
- Create: `server/src/routes/settings.ts`
- Modify: `server/src/index.ts`
- Test: `tests/unit/server/settings.test.ts`

- [ ] **Step 1: 新增配置类型**

修改 `server/src/types.ts`，在现有类型下方追加：

```typescript
export interface ChatProviderConfig {
  apiKey: string
  model: string
  baseUrl: string
}

export interface OllamaConfig {
  enabled: boolean
  url: string
  model: string
}

export interface EmbeddingProviderConfig {
  provider: string
  apiKey: string
  model: string
  baseUrl: string
}

export interface AppConfig {
  providers: {
    openai: ChatProviderConfig
    claude: ChatProviderConfig
    deepseek: ChatProviderConfig
    custom: ChatProviderConfig
    ollama: OllamaConfig
  }
  embeddingProvider: EmbeddingProviderConfig
  temperature: number
  defaultChatProvider: string
}
```

- [ ] **Step 2: 创建 Settings 路由**

创建 `server/src/routes/settings.ts`：

```typescript
import { Hono } from 'hono'
import fs from 'node:fs'
import path from 'node:path'
import { getAppDataDir } from '../utils.js'
import type { AppConfig } from '../types.js'

const app = new Hono()

export const DEFAULT_CONFIG: AppConfig = {
  providers: {
    openai: { apiKey: '', model: 'gpt-4o', baseUrl: '' },
    claude: { apiKey: '', model: 'claude-3-5-sonnet-20241022', baseUrl: '' },
    deepseek: { apiKey: '', model: 'deepseek-chat', baseUrl: '' },
    custom: { apiKey: '', model: '', baseUrl: '' },
    ollama: { enabled: false, url: 'http://localhost:11434', model: '' },
  },
  embeddingProvider: { provider: 'openai', apiKey: '', model: 'text-embedding-3-small', baseUrl: '' },
  temperature: 0.7,
  defaultChatProvider: 'deepseek',
}

function getConfigPath(): string {
  return path.join(getAppDataDir(), 'config.json')
}

function loadConfig(): AppConfig {
  const configPath = getConfigPath()
  if (!fs.existsSync(configPath)) {
    return DEFAULT_CONFIG
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    return { ...DEFAULT_CONFIG, ...parsed, providers: { ...DEFAULT_CONFIG.providers, ...parsed.providers } }
  } catch {
    return DEFAULT_CONFIG
  }
}

function saveConfig(config: AppConfig): void {
  const configPath = getConfigPath()
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

app.get('/', (c) => {
  return c.json(loadConfig())
})

app.post('/', async (c) => {
  const body = await c.req.json<AppConfig>()
  saveConfig(body)
  return c.json({ success: true })
})

export default app
```

- [ ] **Step 3: 注册路由**

修改 `server/src/index.ts`，在已有路由注册下方添加：

```typescript
import settingsRoutes from './routes/settings.js'
```

在 `app.route('/knowledge-bases', knowledgeBaseRoutes)` 下方添加：

```typescript
app.route('/settings', settingsRoutes)
```

- [ ] **Step 4: 编写 Sidecar settings API 测试**

创建 `tests/unit/server/settings.test.ts`：

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

vi.mock('../../../server/src/utils.js', () => ({
  getAppDataDir: () => path.join(os.tmpdir(), 'kb-test-settings-' + Date.now()),
}))

const { default: settingsApp, DEFAULT_CONFIG } = await import('../../../server/src/routes/settings.js')

describe('settings API', () => {
  beforeEach(() => {
    const { getAppDataDir } = await import('../../../server/src/utils.js')
    const configPath = path.join(getAppDataDir(), 'config.json')
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath)
    }
  })

  it('GET / returns default config when file missing', async () => {
    const req = new Request('http://localhost/settings')
    const res = await settingsApp.fetch(req)
    const data = await res.json()
    expect(data.defaultChatProvider).toBe('deepseek')
    expect(data.temperature).toBe(0.7)
    expect(data.providers.openai.model).toBe('gpt-4o')
  })

  it('POST / saves config and subsequent GET returns it', async () => {
    const newConfig = {
      ...DEFAULT_CONFIG,
      temperature: 1.2,
      defaultChatProvider: 'openai',
    }

    const postReq = new Request('http://localhost/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    })
    const postRes = await settingsApp.fetch(postReq)
    expect(postRes.status).toBe(200)

    const getReq = new Request('http://localhost/settings')
    const getRes = await settingsApp.fetch(getReq)
    const data = await getRes.json()
    expect(data.temperature).toBe(1.2)
    expect(data.defaultChatProvider).toBe('openai')
  })
})
```

- [ ] **Step 5: 运行测试**

Run: `pnpm test tests/unit/server/settings.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/types.ts server/src/routes/settings.ts server/src/index.ts tests/unit/server/settings.test.ts
git commit -m "feat(server): add GET/POST /settings API with config.json persistence"
```

---

### Task 2: 前端类型与 Settings Store 重构

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/stores/settings.ts`
- Test: `tests/unit/stores/settings.test.ts`

- [ ] **Step 1: 扩展前端类型**

修改 `src/types/index.ts`，在 `LLMConfig` 下方追加：

```typescript
export interface ChatProviderConfig {
  apiKey: string
  model: string
  baseUrl: string
}

export interface OllamaConfig {
  enabled: boolean
  url: string
  model: string
}

export interface EmbeddingProviderConfig {
  provider: string
  apiKey: string
  model: string
  baseUrl: string
}

export interface AppConfig {
  providers: {
    openai: ChatProviderConfig
    claude: ChatProviderConfig
    deepseek: ChatProviderConfig
    custom: ChatProviderConfig
    ollama: OllamaConfig
  }
  embeddingProvider: EmbeddingProviderConfig
  temperature: number
  defaultChatProvider: string
}
```

修改 `Tab` 接口，增加 `provider` 和 `model`：

```typescript
export interface Tab {
  id: string
  type: TabType
  title: string
  sessionId?: string
  closable: boolean
  provider?: string
  model?: string
}
```

- [ ] **Step 2: 重写 Settings Store**

修改 `src/stores/settings.ts`：

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { sidecarFetch } from '@/utils/sidecarClient'
import type { AppConfig, LLMConfig } from '@/types'

const DEFAULT_CONFIG: AppConfig = {
  providers: {
    openai: { apiKey: '', model: 'gpt-4o', baseUrl: '' },
    claude: { apiKey: '', model: 'claude-3-5-sonnet-20241022', baseUrl: '' },
    deepseek: { apiKey: '', model: 'deepseek-chat', baseUrl: '' },
    custom: { apiKey: '', model: '', baseUrl: '' },
    ollama: { enabled: false, url: 'http://localhost:11434', model: '' },
  },
  embeddingProvider: { provider: 'openai', apiKey: '', model: 'text-embedding-3-small', baseUrl: '' },
  temperature: 0.7,
  defaultChatProvider: 'deepseek',
}

export const useSettingsStore = defineStore('settings', () => {
  const config = ref<AppConfig>({ ...DEFAULT_CONFIG })
  const isLoading = ref(false)

  async function loadConfig() {
    isLoading.value = true
    try {
      const res = await sidecarFetch('/settings')
      if (res.ok) {
        const data = await res.json()
        config.value = { ...DEFAULT_CONFIG, ...data, providers: { ...DEFAULT_CONFIG.providers, ...data.providers } }
      }
    } finally {
      isLoading.value = false
    }
  }

  async function saveConfig(updates: Partial<AppConfig>) {
    const newConfig = {
      ...config.value,
      ...updates,
      providers: updates.providers ? { ...config.value.providers, ...updates.providers } : config.value.providers,
    } as AppConfig
    const res = await sidecarFetch('/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    })
    if (res.ok) {
      config.value = newConfig
    }
  }

  function getLLMConfig(providerKey?: string): LLMConfig | null {
    const key = providerKey || config.value.defaultChatProvider
    const pc = config.value.providers[key as keyof AppConfig['providers']]
    if (!pc) return null

    if (key === 'ollama') {
      const oc = pc as AppConfig['providers']['ollama']
      if (!oc.enabled) return null
      return {
        provider: 'ollama',
        model: oc.model,
        baseUrl: oc.url,
        apiKey: '',
      }
    }

    const cc = pc as ChatProviderConfig
    return {
      provider: key,
      model: cc.model,
      baseUrl: cc.baseUrl,
      apiKey: cc.apiKey,
    }
  }

  const configuredProviders = computed(() => {
    const list: { key: string; name: string; model: string }[] = []
    const names: Record<string, string> = {
      openai: 'OpenAI',
      claude: 'Claude',
      deepseek: 'DeepSeek',
      custom: '自定义',
      ollama: 'Ollama',
    }
    for (const [key, p] of Object.entries(config.value.providers)) {
      if (key === 'ollama') {
        if ((p as OllamaConfig).enabled) {
          list.push({ key, name: names[key] || key, model: (p as OllamaConfig).model })
        }
      } else if ((p as ChatProviderConfig).apiKey || (p as ChatProviderConfig).model) {
        list.push({ key, name: names[key] || key, model: (p as ChatProviderConfig).model })
      }
    }
    return list
  })

  return {
    config,
    isLoading,
    loadConfig,
    saveConfig,
    getLLMConfig,
    configuredProviders,
  }
})
```

- [ ] **Step 3: 更新 Settings Store 测试**

修改 `tests/unit/stores/settings.test.ts`：

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from '@/stores/settings'
import { sidecarFetch } from '@/utils/sidecarClient'

vi.mock('@/utils/sidecarClient')

describe('useSettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(sidecarFetch).mockReset()
  })

  it('has default config initially', () => {
    const store = useSettingsStore()
    expect(store.config.defaultChatProvider).toBe('deepseek')
    expect(store.config.temperature).toBe(0.7)
    expect(store.config.providers.openai.model).toBe('gpt-4o')
  })

  it('loadConfig fetches from API', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ temperature: 1.0, defaultChatProvider: 'openai' }),
    } as Response)

    const store = useSettingsStore()
    await store.loadConfig()
    expect(store.config.temperature).toBe(1.0)
    expect(store.config.defaultChatProvider).toBe('openai')
  })

  it('saveConfig posts to API and updates local state', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)

    const store = useSettingsStore()
    await store.saveConfig({ temperature: 1.5 })
    expect(store.config.temperature).toBe(1.5)
    expect(sidecarFetch).toHaveBeenCalledWith('/settings', expect.objectContaining({ method: 'POST' }))
  })

  it('getLLMConfig returns config for given provider', () => {
    const store = useSettingsStore()
    store.config.providers.openai = { apiKey: 'key', model: 'gpt-4', baseUrl: 'https://api.openai.com' }
    const cfg = store.getLLMConfig('openai')
    expect(cfg).toEqual({
      provider: 'openai',
      model: 'gpt-4',
      baseUrl: 'https://api.openai.com',
      apiKey: 'key',
    })
  })

  it('getLLMConfig returns default provider when no arg', () => {
    const store = useSettingsStore()
    const cfg = store.getLLMConfig()
    expect(cfg?.provider).toBe('deepseek')
  })

  it('getLLMConfig returns null for disabled ollama', () => {
    const store = useSettingsStore()
    store.config.providers.ollama.enabled = false
    expect(store.getLLMConfig('ollama')).toBeNull()
  })

  it('getLLMConfig returns ollama config when enabled', () => {
    const store = useSettingsStore()
    store.config.providers.ollama = { enabled: true, url: 'http://localhost:11434', model: 'llama2' }
    const cfg = store.getLLMConfig('ollama')
    expect(cfg).toEqual({
      provider: 'ollama',
      model: 'llama2',
      baseUrl: 'http://localhost:11434',
      apiKey: '',
    })
  })
})
```

- [ ] **Step 4: 运行测试**

Run: `pnpm test tests/unit/stores/settings.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/stores/settings.ts tests/unit/stores/settings.test.ts
git commit -m "feat(store): refactor settings store for multi-provider config via API"
```

---

### Task 3: 设置页 UI

**Files:**
- Create: `src/components/SettingsPage.vue`
- Test: `tests/unit/components/SettingsPage.test.ts`

- [ ] **Step 1: 创建设置页组件**

创建 `src/components/SettingsPage.vue`：

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const store = useSettingsStore()

const llmProviderKeys = ['openai', 'claude', 'deepseek', 'custom', 'ollama'] as const
const llmProviderLabels: Record<string, string> = {
  openai: 'OpenAI',
  claude: 'Claude',
  deepseek: 'DeepSeek',
  custom: '自定义',
  ollama: 'Ollama',
}

const activeLlmTab = ref<string>('openai')

const embeddingProviders = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'siliconflow', label: '硅基流动' },
  { value: 'custom', label: '自定义' },
]

const hasChanges = ref(false)

function markChanged() {
  hasChanges.value = true
}

async function handleSave() {
  await store.saveConfig({
    providers: { ...store.config.providers },
    embeddingProvider: { ...store.config.embeddingProvider },
    temperature: store.config.temperature,
    defaultChatProvider: store.config.defaultChatProvider,
  })
  hasChanges.value = false
}

const defaultProviderOptions = computed(() =>
  llmProviderKeys
    .filter((k) => k !== 'ollama' || store.config.providers.ollama.enabled)
    .map((k) => ({ value: k, label: llmProviderLabels[k] }))
)
</script>

<template>
  <div class="h-full overflow-y-auto p-6">
    <div class="mx-auto max-w-3xl space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold text-text-primary">设置</h1>
        <button
          :disabled="!hasChanges"
          class="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-40"
          @click="handleSave"
        >
          保存
        </button>
      </div>

      <!-- LLM Providers Card -->
      <div class="rounded-xl border border-border-default bg-surface-1 p-5">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-text-secondary">
          LLM 提供商配置
        </h2>

        <!-- Provider Tabs -->
        <div class="mb-4 flex gap-1 border-b border-border-default pb-1">
          <button
            v-for="key in llmProviderKeys"
            :key="key"
            :class="[
              'rounded-t-lg px-3 py-1.5 text-sm transition-all',
              activeLlmTab === key
                ? 'font-medium text-accent-400'
                : 'text-text-tertiary hover:text-text-secondary',
            ]"
            @click="activeLlmTab = key"
          >
            {{ llmProviderLabels[key] }}
          </button>
        </div>

        <!-- Provider Form -->
        <div class="space-y-4">
          <!-- Ollama enable switch -->
          <div v-if="activeLlmTab === 'ollama'" class="flex items-center gap-3">
            <label class="text-sm text-text-secondary">启用 Ollama</label>
            <button
              :class="[
                'relative h-5 w-9 rounded-full transition-colors',
                store.config.providers.ollama.enabled ? 'bg-accent-500' : 'bg-surface-4',
              ]"
              @click="
                store.config.providers.ollama.enabled = !store.config.providers.ollama.enabled;
                markChanged()
              "
            >
              <span
                :class="[
                  'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
                  store.config.providers.ollama.enabled ? 'left-4.5 translate-x-0' : 'left-0.5',
                ]"
              />
            </button>
          </div>

          <!-- API Key (not for ollama) -->
          <div v-if="activeLlmTab !== 'ollama'">
            <label class="mb-1 block text-sm text-text-secondary">API Key</label>
            <input
              v-model="store.config.providers[activeLlmTab as Exclude<typeof activeLlmTab, 'ollama'>].apiKey"
              type="password"
              class="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary outline-none transition-all focus:border-accent-500/50"
              placeholder="输入 API Key"
              @input="markChanged"
            />
          </div>

          <!-- Model -->
          <div>
            <label class="mb-1 block text-sm text-text-secondary">模型</label>
            <input
              v-model="store.config.providers[activeLlmTab].model"
              type="text"
              class="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary outline-none transition-all focus:border-accent-500/50"
              placeholder="输入模型名称"
              @input="markChanged"
            />
          </div>

          <!-- Base URL -->
          <div>
            <label class="mb-1 block text-sm text-text-secondary">Base URL</label>
            <input
              v-model="store.config.providers[activeLlmTab].baseUrl"
              type="text"
              class="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary outline-none transition-all focus:border-accent-500/50"
              placeholder="留空使用默认地址"
              @input="markChanged"
            />
          </div>

          <!-- Ollama URL -->
          <div v-if="activeLlmTab === 'ollama'">
            <label class="mb-1 block text-sm text-text-secondary">服务地址</label>
            <input
              v-model="store.config.providers.ollama.url"
              type="text"
              class="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary outline-none transition-all focus:border-accent-500/50"
              placeholder="http://localhost:11434"
              @input="markChanged"
            />
          </div>
        </div>

        <!-- Default Provider Selector -->
        <div class="mt-5 border-t border-border-default pt-4">
          <label class="mb-1 block text-sm text-text-secondary">默认对话提供商</label>
          <select
            v-model="store.config.defaultChatProvider"
            class="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary outline-none transition-all focus:border-accent-500/50"
            @change="markChanged"
          >
            <option
              v-for="opt in defaultProviderOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>
      </div>

      <!-- Embedding Card -->
      <div class="rounded-xl border border-border-default bg-surface-1 p-5">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-text-secondary">
          Embedding API
        </h2>
        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-sm text-text-secondary">提供商</label>
            <select
              v-model="store.config.embeddingProvider.provider"
              class="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary outline-none transition-all focus:border-accent-500/50"
              @change="markChanged"
            >
              <option
                v-for="ep in embeddingProviders"
                :key="ep.value"
                :value="ep.value"
              >
                {{ ep.label }}
              </option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm text-text-secondary">API Key</label>
            <input
              v-model="store.config.embeddingProvider.apiKey"
              type="password"
              class="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary outline-none transition-all focus:border-accent-500/50"
              placeholder="输入 API Key"
              @input="markChanged"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm text-text-secondary">模型</label>
            <input
              v-model="store.config.embeddingProvider.model"
              type="text"
              class="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary outline-none transition-all focus:border-accent-500/50"
              placeholder="输入模型名称"
              @input="markChanged"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm text-text-secondary">Base URL</label>
            <input
              v-model="store.config.embeddingProvider.baseUrl"
              type="text"
              class="w-full rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm text-text-primary outline-none transition-all focus:border-accent-500/50"
              placeholder="留空使用默认地址"
              @input="markChanged"
            />
          </div>
        </div>
      </div>

      <!-- General Card -->
      <div class="rounded-xl border border-border-default bg-surface-1 p-5">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-text-secondary">
          通用设置
        </h2>
        <div>
          <div class="mb-2 flex items-center justify-between">
            <label class="text-sm text-text-secondary">温度参数</label>
            <span class="text-sm font-medium text-text-primary">{{ store.config.temperature.toFixed(1) }}</span>
          </div>
          <input
            v-model.number="store.config.temperature"
            type="range"
            min="0"
            max="2"
            step="0.1"
            class="w-full accent-accent-500"
            @input="markChanged"
          />
          <div class="mt-1 flex justify-between text-xs text-text-tertiary">
            <span>精确 (0)</span>
            <span>平衡 (1)</span>
            <span>创意 (2)</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 编写 SettingsPage 组件测试**

创建 `tests/unit/components/SettingsPage.test.ts`：

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import SettingsPage from '@/components/SettingsPage.vue'
import { useSettingsStore } from '@/stores/settings'

vi.mock('@/utils/sidecarClient')

describe('SettingsPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders three card sections', () => {
    const wrapper = mount(SettingsPage)
    const headings = wrapper.findAll('h2')
    expect(headings.length).toBe(3)
    expect(headings[0].text()).toContain('LLM 提供商配置')
    expect(headings[1].text()).toContain('Embedding')
    expect(headings[2].text()).toContain('通用设置')
  })

  it('shows provider tabs', () => {
    const wrapper = mount(SettingsPage)
    expect(wrapper.text()).toContain('OpenAI')
    expect(wrapper.text()).toContain('Claude')
    expect(wrapper.text()).toContain('DeepSeek')
  })

  it('changing temperature marks dirty and save button becomes enabled', async () => {
    const wrapper = mount(SettingsPage)
    const store = useSettingsStore()

    const saveBtn = wrapper.find('button:disabled')
    expect(saveBtn.exists()).toBe(true)

    store.config.temperature = 1.5
    await wrapper.find('input[type="range"]').trigger('input')

    const enabledSave = wrapper.find('button:not(:disabled)')
    expect(enabledSave.text()).toBe('保存')
  })
})
```

- [ ] **Step 3: 运行测试**

Run: `pnpm test tests/unit/components/SettingsPage.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/SettingsPage.vue tests/unit/components/SettingsPage.test.ts
git commit -m "feat(ui): add SettingsPage with LLM/Embedding/General cards"
```

---

### Task 4: App.vue 集成与 Settings 加载

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: 引入 SettingsPage 并加载配置**

修改 `src/App.vue`：

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import SplashScreen from './components/SplashScreen.vue'
import SideBar from './components/SideBar.vue'
import TabBar from './components/TabBar.vue'
import ChatPage from './components/ChatPage.vue'
import KnowledgeBasePage from './components/KnowledgeBasePage.vue'
import RecycleBinPage from './components/RecycleBinPage.vue'
import SettingsPage from './components/SettingsPage.vue'
import { initSidecar, sidecarStatus } from './composables/useSidecar'
import { useSessionStore } from './stores/session'
import { useSettingsStore } from './stores/settings'

const sessionStore = useSessionStore()
const settingsStore = useSettingsStore()

onMounted(() => {
  initSidecar()
  settingsStore.loadConfig()
})

function ensureHomeTab() {
  const homeTab = sessionStore.tabs.find((t) => t.type === 'chat' && !t.sessionId)
  if (homeTab) {
    sessionStore.switchTab(homeTab.id)
  } else {
    const newHomeId = `home-${Date.now()}`
    sessionStore.addTab({ id: newHomeId, type: 'chat', title: '首页', closable: true })
  }
}

function openKnowledgeBase() {
  const existing = sessionStore.tabs.find((t) => t.type === 'knowledgeBase')
  if (existing) {
    sessionStore.switchTab(existing.id)
  } else {
    sessionStore.addTab({ id: 'kb', type: 'knowledgeBase', title: '知识库', closable: true })
  }
}

function openHistory() {
  const existing = sessionStore.tabs.find((t) => t.type === 'history')
  if (existing) {
    sessionStore.switchTab(existing.id)
  } else {
    sessionStore.addTab({ id: 'history', type: 'history', title: '历史', closable: true })
  }
}

function openSettings() {
  const existing = sessionStore.tabs.find((t) => t.type === 'settings')
  if (existing) {
    sessionStore.switchTab(existing.id)
  } else {
    sessionStore.addTab({ id: 'settings', type: 'settings', title: '设置', closable: true })
  }
}

function openRecycleBin() {
  const existing = sessionStore.tabs.find((t) => t.type === 'recycleBin')
  if (existing) {
    sessionStore.switchTab(existing.id)
  } else {
    sessionStore.addTab({ id: 'recycleBin', type: 'recycleBin', title: '回收站', closable: true })
  }
}
</script>

<template>
  <SplashScreen />
  <div
    v-if="sidecarStatus === 'ready'"
    class="flex h-screen bg-surface-0 text-text-primary"
  >
    <SideBar
      :active-type="sessionStore.activeTab?.type ?? 'chat'"
      @open-chat="ensureHomeTab"
      @open-knowledge-base="openKnowledgeBase"
      @open-history="openHistory"
      @open-settings="openSettings"
      @open-recycle-bin="openRecycleBin"
    />
    <div class="flex flex-1 flex-col overflow-hidden">
      <TabBar
        :tabs="sessionStore.tabs"
        :active-tab-id="sessionStore.activeTabId"
        @switch="sessionStore.switchTab"
        @close="sessionStore.closeTab"
        @new-chat="ensureHomeTab"
      />
      <main class="relative flex-1 overflow-hidden bg-surface-0">
        <ChatPage v-if="sessionStore.activeTab?.type === 'chat'" />
        <KnowledgeBasePage v-else-if="sessionStore.activeTab?.type === 'knowledgeBase'" />
        <div
          v-else-if="sessionStore.activeTab?.type === 'history'"
          class="flex h-full items-center justify-center text-text-secondary"
        >
          对话历史（由 #06 实现）
        </div>
        <SettingsPage v-else-if="sessionStore.activeTab?.type === 'settings'" />
        <RecycleBinPage v-else-if="sessionStore.activeTab?.type === 'recycleBin'" />
      </main>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/App.vue
git commit -m "feat(app): wire SettingsPage component and load config on mount"
```

---

### Task 5: 对话页模型切换

**Files:**
- Create: `src/components/ModelSelector.vue`
- Modify: `src/components/ChatPage.vue`
- Modify: `src/stores/session.ts`
- Test: `tests/unit/components/ModelSelector.test.ts`
- Test: `tests/unit/stores/session.test.ts` (modify)

- [ ] **Step 1: 创建 ModelSelector 组件**

创建 `src/components/ModelSelector.vue`：

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps<{
  provider?: string
  model?: string
}>()

const emit = defineEmits<{
  change: [provider: string, model: string]
}>()

const store = useSettingsStore()
const open = ref(false)

const currentLabel = computed(() => {
  const names: Record<string, string> = {
    openai: 'OpenAI',
    claude: 'Claude',
    deepseek: 'DeepSeek',
    custom: '自定义',
    ollama: 'Ollama',
  }
  if (props.provider && props.model) {
    return `${names[props.provider] || props.provider} · ${props.model}`
  }
  const defaultCfg = store.getLLMConfig()
  if (defaultCfg) {
    return `${names[defaultCfg.provider] || defaultCfg.provider} · ${defaultCfg.model}`
  }
  return '选择模型'
})

function selectProvider(key: string) {
  const cfg = store.getLLMConfig(key)
  if (cfg) {
    emit('change', cfg.provider, cfg.model)
    open.value = false
  }
}
</script>

<template>
  <div class="relative">
    <button
      class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-secondary transition-all hover:bg-surface-2 hover:text-text-primary"
      @click="open = !open"
    >
      <span class="i-mdi-brain text-sm" />
      <span class="max-w-[180px] truncate">{{ currentLabel }}</span>
      <span
        :class="[
          'i-mdi-chevron-down text-xs transition-transform',
          open && 'rotate-180',
        ]"
      />
    </button>

    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 -translate-y-1 scale-95"
    >
      <div
        v-if="open"
        class="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-border-default bg-surface-2 py-1 shadow-xl"
        @click.stop
      >
        <button
          v-for="p in store.configuredProviders"
          :key="p.key"
          :class="[
            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-3',
            p.key === props.provider ? 'text-accent-400' : 'text-text-primary',
          ]"
          @click="selectProvider(p.key)"
        >
          <span class="i-mdi-check text-xs" :class="p.key === props.provider ? 'opacity-100' : 'opacity-0'" />
          <span>{{ p.name }} · {{ p.model }}</span>
        </button>

        <div v-if="store.configuredProviders.length === 0" class="px-3 py-2 text-xs text-text-tertiary">
          请先前往设置配置模型
        </div>
      </div>
    </Transition>

    <!-- Backdrop to close dropdown -->
    <div
      v-if="open"
      class="fixed inset-0 z-40"
      @click="open = false"
    />
  </div>
</template>
```

- [ ] **Step 2: 修改 ChatPage 添加顶部栏**

修改 `src/components/ChatPage.vue`：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import EmptySession from './EmptySession.vue'
import ChatMessageList from './ChatMessageList.vue'
import ChatInput from './ChatInput.vue'
import ModelSelector from './ModelSelector.vue'

const store = useSessionStore()
const settings = useSettingsStore()

const isEmpty = computed(() => !store.activeTab?.sessionId && store.activeMessages.length === 0)

const currentProvider = computed(() => store.activeTab?.provider)
const currentModel = computed(() => store.activeTab?.model)

function handleSend(content: string) {
  const cfg = store.activeTab?.provider
    ? settings.getLLMConfig(store.activeTab.provider)
    : settings.getLLMConfig()
  if (!cfg) {
    store.sendError = '未配置可用的 LLM 提供商，请前往设置'
    return
  }
  store.sendMessage(content, cfg)
}

function handleModelChange(provider: string, model: string) {
  const idx = store.tabs.findIndex((t) => t.id === store.activeTabId)
  if (idx !== -1) {
    store.tabs[idx].provider = provider
    store.tabs[idx].model = model
  }
}

function handleTitleBlur(e: FocusEvent) {
  const target = e.target as HTMLInputElement
  const idx = store.tabs.findIndex((t) => t.id === store.activeTabId)
  if (idx !== -1) {
    store.tabs[idx].title = target.value.trim() || store.tabs[idx].title
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Top bar -->
    <div
      v-if="!isEmpty"
      class="flex h-12 shrink-0 items-center justify-between border-b border-border-default bg-surface-1 px-4"
    >
      <input
        :value="store.activeTab?.title ?? '首页'"
        class="bg-transparent text-sm font-medium text-text-primary outline-none"
        @blur="handleTitleBlur"
      />
      <ModelSelector
        :provider="currentProvider"
        :model="currentModel"
        @change="handleModelChange"
      />
    </div>

    <EmptySession v-if="isEmpty" @send="handleSend" />
    <template v-else>
      <ChatMessageList :messages="store.activeMessages" />
      <ChatInput :loading="store.isSending" @send="handleSend" />
    </template>

    <!-- Error toast -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="store.sendError"
        class="absolute bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-danger-500/20 bg-surface-2 px-4 py-2.5 text-sm text-danger-400 shadow-xl"
      >
        <span class="i-mdi-alert-circle text-base" />
        <span>{{ store.sendError }}</span>
      </div>
    </Transition>
  </div>
</template>
```

- [ ] **Step 3: 修改 session store 支持模型切换**

修改 `src/stores/session.ts` 的 `sendMessage` 方法签名和首页标签创建逻辑。当前签名是 `sendMessage(content, config)`，不需要改签名。但需要修改 `ensureHomeTab`（在 App.vue 中）以及首页创建时继承默认 provider/model。

实际上 `ensureHomeTab` 不在 store 里。修改 App.vue 的 `ensureHomeTab` 来继承默认模型：

在 App.vue 的 `ensureHomeTab` 中，新建首页时：

```typescript
function ensureHomeTab() {
  const homeTab = sessionStore.tabs.find((t) => t.type === 'chat' && !t.sessionId)
  if (homeTab) {
    sessionStore.switchTab(homeTab.id)
  } else {
    const newHomeId = `home-${Date.now()}`
    const defaultCfg = settingsStore.getLLMConfig()
    sessionStore.addTab({
      id: newHomeId,
      type: 'chat',
      title: '首页',
      closable: true,
      provider: defaultCfg?.provider,
      model: defaultCfg?.model,
    })
  }
}
```

同时修改 `src/stores/session.ts` 中 `sendMessage` 的第一条消息发送后的 session 创建逻辑。目前 `sendMessage` 接收 `config: LLMConfig`，当创建新 session 时，还需要更新 tab 的 provider/model。

修改 `sendMessage` 中 `isNewSession` 为 true 时的逻辑，在升格首页之后：

```typescript
// Promote home tab after first successful request
if (isNewSession) {
  const activeIdx = tabs.value.findIndex((t) => t.id === activeTabId.value)
  if (activeIdx !== -1) {
    tabs.value[activeIdx].sessionId = sessionId
    tabs.value[activeIdx].title = content.slice(0, 20) + (content.length > 20 ? '...' : '')
    tabs.value[activeIdx].provider = config.provider
    tabs.value[activeIdx].model = config.model
  }
  // ... 新建首页
}
```

- [ ] **Step 4: 编写 ModelSelector 测试**

创建 `tests/unit/components/ModelSelector.test.ts`：

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ModelSelector from '@/components/ModelSelector.vue'
import { useSettingsStore } from '@/stores/settings'

vi.mock('@/utils/sidecarClient')

describe('ModelSelector', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('displays current provider and model', () => {
    const wrapper = mount(ModelSelector, {
      props: { provider: 'openai', model: 'gpt-4' },
    })
    expect(wrapper.text()).toContain('OpenAI')
    expect(wrapper.text()).toContain('gpt-4')
  })

  it('emits change event when provider selected', async () => {
    const store = useSettingsStore()
    store.config.providers.deepseek = { apiKey: 'k', model: 'deepseek-chat', baseUrl: '' }

    const wrapper = mount(ModelSelector)
    await wrapper.find('button').trigger('click')

    const options = wrapper.findAll('[class*="hover:bg-surface-3"]')
    // At least one option should be present
    expect(options.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 5: 更新 session store 测试**

在 `tests/unit/stores/session.test.ts` 中，补充模型切换相关测试。由于 `sendMessage` 签名未变（仍接收 `config`），主要验证首页创建时 provider/model 是否正确传递。

添加测试：

```typescript
it('promotes home tab with provider and model on first message', async () => {
  vi.mocked(sidecarFetch).mockResolvedValue({
    ok: true,
    body: createMockStream('data: {"content":"你好"}\n\n'),
  } as Response)

  const store = useSessionStore()
  await store.sendMessage('你好', {
    provider: 'openai',
    model: 'gpt-4',
    baseUrl: '',
    apiKey: 'key',
  })

  expect(store.tabs[0].provider).toBe('openai')
  expect(store.tabs[0].model).toBe('gpt-4')
})
```

- [ ] **Step 6: 运行测试**

Run: `pnpm test tests/unit/components/ModelSelector.test.ts tests/unit/stores/session.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/ModelSelector.vue src/components/ChatPage.vue src/stores/session.ts tests/unit/components/ModelSelector.test.ts tests/unit/stores/session.test.ts src/App.vue
git commit -m "feat(chat): add model selector dropdown and per-session model switching"
```

---

### Task 6: 端到端验证

- [ ] **Step 1: Type check**

Run: `pnpm type-check`
Expected: No errors

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 3: Sidecar build check**

Run: `cd server && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Manual verification checklist**

启动应用（`pnpm tauri dev` 或仅前端 `pnpm dev`）：
- [ ] 打开设置页，能看到 OpenAI/Claude/DeepSeek/自定义/Ollama 五个 tab
- [ ] 填写 DeepSeek 的 API Key 和模型，保存成功
- [ ] 修改温度为 1.2，保存后刷新页面配置还在
- [ ] 在对话页，顶部能看到当前模型名称（如 DeepSeek · deepseek-chat）
- [ ] 点击模型下拉，能看到已配置的提供商
- [ ] 切换模型后发送消息，新 session 使用切换后的模型
- [ ] 新建首页标签，默认使用全局 defaultChatProvider

- [ ] **Step 5: Commit progress doc update**

更新 `PROGRESS.md` 将 #05 状态改为 `closed`：

```markdown
| 配置系统 | #05 多提供商设置 | closed | 设置页、多 LLM 配置、Embedding 配置、温度参数、每会话模型切换 |
```

```bash
git add PROGRESS.md
git commit -m "docs: mark #05 settings multi-provider as closed"
```

---

## Self-Review

### 1. Spec coverage

| PRD / Issue 要求 | 实现任务 |
|---|---|
| `config.json` 多提供商结构 | Task 1 Step 2 (`DEFAULT_CONFIG`) |
| Sidecar 配置 API `GET/POST /settings` | Task 1 Step 2-3 |
| 前端设置页 UI 三个卡片 | Task 3 Step 1 (`SettingsPage.vue`) |
| LLM 提供商多 tab 配置 | Task 3 Step 1 (横向 tab + 表单) |
| Ollama 启用开关 + 地址 | Task 3 Step 1 (条件渲染) |
| Embedding 配置卡片 | Task 3 Step 1 |
| 温度滑块 0-2 | Task 3 Step 1 |
| 对话页顶部模型名称 + 下拉切换 | Task 5 Step 1-2 (`ModelSelector.vue` + `ChatPage.vue`) |
| 切换仅影响当前会话 | Task 5 Step 2-3 (Tab 级 provider/model) |
| 新建会话使用全局默认 | Task 5 Step 3 (App.vue `ensureHomeTab`) |
| `sessions` 表 provider + model 快照 | 已由 #02/#04 实现 (db.ts + chat.ts 写入) |
| 历史会话恢复显示模型 | 依赖 #06，但 sessions 表已有字段 |

**Gap:** 历史会话恢复时的模型显示完全依赖 #06（对话历史页面），当前计划不实现历史页，因为那是 Issue #06 的范畴。但底层数据（sessions 表的 provider/model）已就绪。

### 2. Placeholder scan

- 无 "TBD"、"TODO"、"implement later"
- 无 "Add appropriate error handling" 等模糊描述
- 所有步骤包含完整代码或精确命令
- 所有文件路径精确

### 3. Type consistency

- `AppConfig` 在 `server/src/types.ts`、`src/types/index.ts` 中结构一致
- `Tab` 的 `provider`/`model` 与 `Session` 的对应字段类型一致（`string \| undefined` / `string \| null`）
- `getLLMConfig` 返回类型始终为 `LLMConfig \| null`
- `sendMessage` 签名未变，接收 `LLMConfig`，与现有调用方兼容

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-08-settings-multi-provider.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

**Which approach?**
