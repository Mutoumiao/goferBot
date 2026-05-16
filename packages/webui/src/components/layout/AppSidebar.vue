<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  SparklesIcon,
  MessageSquareTextIcon,
  DatabaseIcon,
  HistoryIcon,
  SettingsIcon,
} from 'lucide-vue-next'

const props = defineProps<{
  activeType?: string
}>()

const emit = defineEmits<{
  navigate: [name: string]
}>()

interface NavItem {
  type: string
  icon: typeof SparklesIcon
  label: string
  ariaLabel: string
}

const topItems: NavItem[] = [
  {
    type: 'chat',
    icon: MessageSquareTextIcon,
    label: '问答首页',
    ariaLabel: '问答首页',
  },
  {
    type: 'knowledgeBase',
    icon: DatabaseIcon,
    label: '知识库',
    ariaLabel: '知识库管理',
  },
]

const bottomItems: NavItem[] = [
  {
    type: 'history',
    icon: HistoryIcon,
    label: '历史记录',
    ariaLabel: '对话历史',
  },
  {
    type: 'settings',
    icon: SettingsIcon,
    label: '设置',
    ariaLabel: '设置',
  },
]

const mobileItems: NavItem[] = [...topItems, ...bottomItems]

function isActive(type: string) {
  return props.activeType === type
}

function handleClick(type: string) {
  emit('navigate', type)
}
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <!-- 桌面端侧边栏 -->
    <aside
      class="hidden md:flex w-16 shrink-0 flex-col items-center justify-between bg-surface-nav py-5 px-3"
      aria-label="主导航"
    >
      <div class="flex flex-col items-center gap-3">
        <div
          class="flex h-9 w-9 items-center justify-center rounded-2xl border border-border-default bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          aria-hidden="true"
        >
          <SparklesIcon class="size-5 text-accent-500" />
        </div>

        <Tooltip v-for="item in topItems" :key="item.type">
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              :class="[
                'h-10 w-10 rounded-2xl transition-all duration-200',
                isActive(item.type)
                  ? 'bg-nav-active text-text-primary hover:bg-nav-active'
                  : 'text-text-tertiary hover:bg-surface-3/70 hover:text-text-secondary',
              ]"
              :aria-label="item.ariaLabel"
              :aria-current="isActive(item.type) ? 'page' : undefined"
              @click="handleClick(item.type)"
            >
              <Component :is="item.icon" class="size-5" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            :side-offset="8"
            class="bg-surface-2 text-text-primary text-xs rounded-md border-0"
          >
            {{ item.label }}
          </TooltipContent>
        </Tooltip>
      </div>

      <div class="flex flex-col items-center gap-2.5">
        <Tooltip v-for="item in bottomItems" :key="item.type">
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              :class="[
                'h-10 w-10 rounded-2xl transition-all duration-200',
                isActive(item.type)
                  ? 'bg-nav-active text-text-primary hover:bg-nav-active'
                  : 'text-text-tertiary hover:bg-surface-3/70 hover:text-text-secondary',
              ]"
              :aria-label="item.ariaLabel"
              :aria-current="isActive(item.type) ? 'page' : undefined"
              @click="handleClick(item.type)"
            >
              <Component :is="item.icon" class="size-5" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            :side-offset="8"
            class="bg-surface-2 text-text-primary text-xs rounded-md border-0"
          >
            {{ item.label }}
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>

    <!-- 移动端底部导航栏 -->
    <nav
      class="flex md:hidden fixed bottom-0 left-0 right-0 h-12 bg-surface-nav border-t border-border-default z-50"
      style="padding-bottom: env(safe-area-inset-bottom);"
      aria-label="底部导航"
    >
      <Button
        v-for="item in mobileItems"
        :key="item.type"
        variant="ghost"
        size="icon"
        :class="[
          'flex-1 h-12 rounded-none transition-all duration-200',
          isActive(item.type)
            ? 'bg-nav-active text-text-primary hover:bg-nav-active'
            : 'text-text-tertiary hover:bg-surface-3/70 hover:text-text-secondary',
        ]"
        :aria-label="item.ariaLabel"
        :aria-current="isActive(item.type) ? 'page' : undefined"
        @click="handleClick(item.type)"
      >
        <Component :is="item.icon" class="size-5" aria-hidden="true" />
      </Button>
    </nav>
  </TooltipProvider>
</template>
