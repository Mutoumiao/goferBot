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
      class="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs text-text-secondary transition-all hover:bg-surface-2 hover:text-text-primary"
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
        class="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-border-default bg-white py-1 shadow-xl"
        @click.stop
      >
        <button
          v-for="p in store.configuredProviders"
          :key="p.key"
          :class="[
            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2',
            p.key === props.provider ? 'text-accent-500' : 'text-text-primary',
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
