import type { ProviderListItem } from '@goferbot/data'
import { BotIcon, CheckIcon, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/utils/cn'

interface ProviderSelectorProps {
  providers: ProviderListItem[]
  selectedKey: string | null
  onChange: (key: string) => void
  disabled?: boolean
}

/**
 * Provider 选择器 —— 使用 shadcn Popover 组件
 * 内置点击外部关闭、ESC 关闭、动画过渡
 */
export function ProviderSelector({
  providers,
  selectedKey,
  onChange,
  disabled = false,
}: ProviderSelectorProps) {
  const selected = providers.find(p => p.key === selectedKey) ?? null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-testid="provider-selector-trigger"
          disabled={disabled || providers.length === 0}
          className="inline-flex h-auto items-center gap-1 rounded px-2 py-0.5 text-xs text-text-secondary hover:bg-surface-2 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
          title={selected ? `${selected.name} · ${selected.model}` : '选择模型'}
        >
          <BotIcon className="size-3.5" />
          <span>{selected ? selected.name : '模型'}</span>
          {selected && (
            <span className="ml-0.5 text-[10px] text-text-tertiary">
              {selected.model}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        className="w-72 rounded-xl border border-border-default bg-surface-1 p-0 shadow-xl"
        data-testid="provider-selector-dropdown"
      >
        {providers.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-4 text-center text-sm text-text-secondary">
            <Sparkles className="size-4 text-text-tertiary" />
            <p>暂无可选模型</p>
          </div>
        ) : (
          <div role="listbox" aria-label="选择对话模型">
            {providers.map(p => {
              const isSelected = p.key === selectedKey
              return (
                <div
                  key={p.key}
                  role="option"
                  aria-selected={isSelected}
                  data-testid="provider-selector-item"
                  className={cn(
                    'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors first:rounded-t-xl last:rounded-b-xl',
                    'text-text-primary hover:bg-surface-2',
                    isSelected && 'bg-brand-primary/5 hover:bg-brand-primary/10',
                  )}
                  onClick={() => onChange(p.key)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onChange(p.key)
                    }
                  }}
                  tabIndex={0}
                >
                  <BotIcon className="size-4 shrink-0 text-text-secondary" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm">{p.name}</span>
                    <span className="truncate text-[11px] text-text-tertiary">
                      {p.model}
                      {p.isBuiltin ? ' · 官方' : ''}
                    </span>
                  </div>
                  {isSelected && (
                    <CheckIcon
                      className="size-4 shrink-0 text-brand-primary"
                      aria-hidden
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
