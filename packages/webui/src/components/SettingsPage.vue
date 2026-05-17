<script setup lang="ts">
import { ref, reactive, watch, computed, onMounted } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  EyeIcon,
  EyeOffIcon,
  CheckIcon,
  AlertCircleIcon,
} from 'lucide-vue-next'
import type { AppConfig, ChatProviderConfig } from '@/types'

const store = useSettingsStore()

const llmProviderKeys = ['openai', 'claude', 'deepseek', 'custom', 'ollama'] as const
const llmProviderLabels: Record<string, string> = {
  openai: 'OpenAI',
  claude: 'Claude',
  deepseek: 'DeepSeek',
  custom: '自定义',
  ollama: 'Ollama',
}

type ProviderKey = typeof llmProviderKeys[number]
const activeLlmTab = ref<ProviderKey>('openai')

const embeddingProviders = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'siliconflow', label: '硅基流动' },
  { value: 'custom', label: '自定义' },
]

const hasChanges = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)
const toastTimer = ref<ReturnType<typeof setTimeout> | null>(null)

const showPassword = ref<Record<string, boolean>>({})

function cloneConfig<T>(obj: T): T {
  return structuredClone(obj)
}

const localConfig = reactive<AppConfig>(cloneConfig(store.config))

onMounted(() => {
  store.loadConfig()
})

watch(
  () => store.config,
  (newVal) => {
    Object.assign(localConfig, cloneConfig(newVal))
    hasChanges.value = false
  },
  { deep: true },
)

function markChanged() {
  hasChanges.value = true
  saveSuccess.value = false
}

function togglePassword(key: string) {
  showPassword.value[key] = !showPassword.value[key]
}

function isMasked(value: string): boolean {
  return value.includes('***') || value.includes('****')
}

const defaultProviderOptions = computed(() => {
  const options: { value: string; label: string }[] = []
  for (const key of llmProviderKeys) {
    if (key === 'ollama') {
      if (localConfig.providers.ollama.enabled) {
        options.push({ value: key, label: llmProviderLabels[key] })
      }
    } else {
      const cfg = localConfig.providers[key] as ChatProviderConfig
      if (cfg.apiKey && !isMasked(cfg.apiKey)) {
        options.push({ value: key, label: llmProviderLabels[key] })
      }
    }
  }
  return options
})

function validate(): string | null {
  if (localConfig.temperature < 0 || localConfig.temperature > 2) {
    return '温度参数必须在 0-2 之间'
  }
  if (localConfig.defaultChatProvider) {
    const validKeys = defaultProviderOptions.value.map((o) => o.value)
    if (!validKeys.includes(localConfig.defaultChatProvider)) {
      return '默认对话提供商必须是已配置且有效的提供商'
    }
  }
  return null
}

async function handleSave() {
  saveError.value = ''
  saveSuccess.value = false
  if (toastTimer.value) clearTimeout(toastTimer.value)

  const err = validate()
  if (err) {
    saveError.value = err
    return
  }

  try {
    const ok = await store.saveConfig(cloneConfig(localConfig))
    if (ok) {
      hasChanges.value = false
      saveSuccess.value = true
      toastTimer.value = setTimeout(() => {
        saveSuccess.value = false
      }, 3000)
    } else {
      saveError.value = '保存失败，请检查配置'
    }
  } catch (e) {
    saveError.value = '保存失败，请检查配置'
  }
}

onBeforeRouteLeave((_to, _from, next) => {
  if (hasChanges.value) {
    const confirmLeave = window.confirm('配置有未保存的更改，确定要离开吗？')
    next(confirmLeave)
  } else {
    next()
  }
})
</script>

<template>
  <div class="h-full overflow-y-auto bg-surface-1 p-6">
    <div class="mx-auto max-w-3xl space-y-6" data-testid="settings-form">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold text-text-primary">设置</h1>
        <Button
          :disabled="!hasChanges"
          data-testid="settings-save-btn"
          class="rounded-2xl bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-40"
          @click="handleSave"
        >
          保存
        </Button>
      </div>

      <!-- LLM Providers Card -->
      <Card class="rounded-2xl border border-border-default bg-white shadow-sm">
        <CardHeader class="pb-4">
          <CardTitle class="text-lg font-medium text-text-primary">
            LLM 提供商配置
          </CardTitle>
        </CardHeader>
        <CardContent class="space-y-5">
          <!-- Provider Tabs -->
          <div class="flex gap-1 border-b border-border-default pb-1" data-testid="settings-nav-tabs">
            <Button
              v-for="key in llmProviderKeys"
              :key="key"
              variant="ghost"
              size="sm"
              :class="[
                'rounded-t-lg px-3 py-1.5 text-sm',
                activeLlmTab === key
                  ? 'font-medium text-accent-500 hover:text-accent-500'
                  : 'text-text-tertiary hover:text-text-secondary',
              ]"
              @click="activeLlmTab = key"
            >
              {{ llmProviderLabels[key] }}
            </Button>
          </div>

          <!-- Provider Form -->
          <div class="space-y-4">
            <!-- Ollama enable switch -->
            <div v-if="activeLlmTab === 'ollama'" class="flex items-center gap-3">
              <span class="text-sm text-text-secondary">启用 Ollama</span>
              <Switch
                :checked="localConfig.providers.ollama.enabled"
                @update:checked="
                  (v: boolean) => {
                    localConfig.providers.ollama.enabled = v
                    markChanged()
                  }
                "
              />
            </div>

            <!-- API Key (not for ollama) -->
            <div v-if="activeLlmTab !== 'ollama'">
              <label class="mb-1 block text-sm text-text-secondary">API Key</label>
              <div class="relative">
                <Input
                  v-model="localConfig.providers[activeLlmTab].apiKey"
                  :type="showPassword[activeLlmTab] ? 'text' : 'password'"
                  class="rounded-lg border-border-default bg-surface-2 pr-10 text-sm text-text-primary focus:border-accent-500/50"
                  placeholder="输入 API Key"
                  @input="markChanged"
                />
                <button
                  type="button"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
                  @click="togglePassword(activeLlmTab)"
                >
                  <EyeIcon v-if="!showPassword[activeLlmTab]" class="size-4" />
                  <EyeOffIcon v-else class="size-4" />
                </button>
              </div>
            </div>

            <!-- Model -->
            <div>
              <label class="mb-1 block text-sm text-text-secondary">模型</label>
              <Input
                v-model="localConfig.providers[activeLlmTab].model"
                type="text"
                class="rounded-lg border-border-default bg-surface-2 text-sm text-text-primary focus:border-accent-500/50"
                placeholder="输入模型名称"
                @input="markChanged"
              />
            </div>

            <!-- Base URL -->
            <div v-if="activeLlmTab !== 'ollama'">
              <label class="mb-1 block text-sm text-text-secondary">Base URL（可选）</label>
              <Input
                v-model="localConfig.providers[activeLlmTab].baseUrl"
                type="text"
                class="rounded-lg border-border-default bg-surface-2 text-sm text-text-primary focus:border-accent-500/50"
                placeholder="留空使用默认地址"
                @input="markChanged"
              />
            </div>

            <!-- Ollama URL -->
            <div v-if="activeLlmTab === 'ollama'">
              <label class="mb-1 block text-sm text-text-secondary">服务地址</label>
              <Input
                v-model="localConfig.providers.ollama.url"
                type="text"
                class="rounded-lg border-border-default bg-surface-2 text-sm text-text-primary focus:border-accent-500/50"
                placeholder="http://localhost:11434"
                @input="markChanged"
              />
            </div>
          </div>

          <Separator />

          <!-- Default Provider Selector -->
          <div>
            <label class="mb-1 block text-sm text-text-secondary">默认对话提供商</label>
            <Select
              v-model="localConfig.defaultChatProvider"
              @update:model-value="markChanged"
            >
              <SelectTrigger class="w-full rounded-lg border-border-default bg-surface-2 text-sm text-text-primary">
                <SelectValue placeholder="选择默认提供商" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    v-for="opt in defaultProviderOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <!-- Embedding Card -->
      <Card class="rounded-2xl border border-border-default bg-white shadow-sm">
        <CardHeader class="pb-4">
          <CardTitle class="text-lg font-medium text-text-primary">
            Embedding API
          </CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div>
            <label class="mb-1 block text-sm text-text-secondary">提供商</label>
            <Select
              v-model="localConfig.embeddingProvider.provider"
              @update:model-value="markChanged"
            >
              <SelectTrigger class="w-full rounded-lg border-border-default bg-surface-2 text-sm text-text-primary">
                <SelectValue placeholder="选择提供商" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    v-for="ep in embeddingProviders"
                    :key="ep.value"
                    :value="ep.value"
                  >
                    {{ ep.label }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label class="mb-1 block text-sm text-text-secondary">API Key</label>
            <div class="relative">
              <Input
                v-model="localConfig.embeddingProvider.apiKey"
                :type="showPassword['embedding'] ? 'text' : 'password'"
                class="rounded-lg border-border-default bg-surface-2 pr-10 text-sm text-text-primary focus:border-accent-500/50"
                placeholder="输入 API Key"
                @input="markChanged"
              />
              <button
                type="button"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
                @click="togglePassword('embedding')"
              >
                <EyeIcon v-if="!showPassword['embedding']" class="size-4" />
                <EyeOffIcon v-else class="size-4" />
              </button>
            </div>
          </div>
          <div>
            <label class="mb-1 block text-sm text-text-secondary">模型</label>
            <Input
              v-model="localConfig.embeddingProvider.model"
              type="text"
              class="rounded-lg border-border-default bg-surface-2 text-sm text-text-primary focus:border-accent-500/50"
              placeholder="输入模型名称"
              @input="markChanged"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm text-text-secondary">Base URL（可选）</label>
            <Input
              v-model="localConfig.embeddingProvider.baseUrl"
              type="text"
              class="rounded-lg border-border-default bg-surface-2 text-sm text-text-primary focus:border-accent-500/50"
              placeholder="留空使用默认地址"
              @input="markChanged"
            />
          </div>
        </CardContent>
      </Card>

      <!-- General Card -->
      <Card class="rounded-2xl border border-border-default bg-white shadow-sm">
        <CardHeader class="pb-4">
          <CardTitle class="text-lg font-medium text-text-primary">
            通用配置
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <div class="mb-2 flex items-center justify-between">
              <label class="text-sm text-text-secondary">温度参数</label>
              <span class="text-sm font-medium text-text-primary">{{ localConfig.temperature.toFixed(1) }}</span>
            </div>
            <input
              v-model.number="localConfig.temperature"
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
        </CardContent>
      </Card>

      <!-- Save Button (bottom) -->
      <div class="flex items-center justify-end gap-3 pt-2">
        <p v-if="saveError" class="text-sm text-danger-500">{{ saveError }}</p>
        <Button
          :disabled="!hasChanges"
          data-testid="settings-save-btn"
          class="rounded-2xl bg-accent-500 px-5 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-40"
          @click="handleSave"
        >
          保存
        </Button>
      </div>
    </div>

    <!-- Success Toast -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="saveSuccess"
        class="fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-success-500/20 bg-white px-4 py-2.5 text-sm text-success-500 shadow-xl"
      >
        <CheckIcon class="size-4" />
        <span>保存成功</span>
      </div>
    </Transition>

    <!-- Error Toast -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="saveError"
        class="fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-danger-500/20 bg-white px-4 py-2.5 text-sm text-danger-500 shadow-xl"
      >
        <AlertCircleIcon class="size-4" />
        <span>{{ saveError }}</span>
      </div>
    </Transition>
  </div>
</template>
