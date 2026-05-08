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

type ProviderKey = 'openai' | 'claude' | 'deepseek' | 'custom' | 'ollama'
const activeLlmTab = ref<ProviderKey>('openai')

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
    .map((k) => ({ value: k, label: llmProviderLabels[k] })),
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
              v-model="store.config.providers[activeLlmTab as 'openai' | 'claude' | 'deepseek' | 'custom'].apiKey"
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
          <div v-if="activeLlmTab !== 'ollama'">
            <label class="mb-1 block text-sm text-text-secondary">Base URL</label>
            <input
              v-model="store.config.providers[activeLlmTab as 'openai' | 'claude' | 'deepseek' | 'custom'].baseUrl"
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
