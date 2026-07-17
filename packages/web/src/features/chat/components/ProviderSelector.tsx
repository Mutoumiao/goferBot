import type { ProviderListItem } from '@goferbot/data'
import { BotIcon, CheckIcon, ChevronDown, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/utils/cn'

interface ProviderSelectorProps {
  providers: ProviderListItem[]
  selectedKey: string | null
  onChange: (key: string) => void
  disabled?: boolean
  /** chip = 胶囊；ghost = 紧凑工具栏 */
  variant?: 'chip' | 'ghost'
  loading?: boolean
  /** 列表为空或加载失败时的重试 */
  onRetry?: () => void
}

/**
 * 模型选择器。
 * - 受控 open，选中后关闭
 * - mousedown preventDefault，避免 Popover 抢焦点导致 click 丢失
 * - 空列表仍可打开，展示提示与重试（不再整颗按钮永久 disabled）
 */
export function ProviderSelector({
  providers,
  selectedKey,
  onChange,
  disabled = false,
  variant = 'ghost',
  loading = false,
  onRetry,
}: ProviderSelectorProps) {
  const [open, setOpen] = useState(false)
  const selected = providers.find((p) => p.key === selectedKey) ?? null
  /** 展示模型名优先，避免同 provider 下切换看不出变化 */
  const label = selected ? selected.model || selected.name : loading ? '加载中…' : '选择模型'

  const handlePick = (key: string) => {
    onChange(key)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="provider-selector-trigger"
          disabled={disabled}
          aria-expanded={open}
          className={cn(
            'inline-flex h-auto items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            variant === 'chip'
              ? 'border border-border-subtle bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary'
              : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
          )}
          title={selected ? `${selected.name} · ${selected.model}` : '选择模型'}
        >
          {variant === 'chip' ? null : <BotIcon className="size-3.5" />}
          <span className="max-w-[140px] truncate">{label}</span>
          <ChevronDown className="size-3 opacity-70" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        className="z-[80] w-72 rounded-xl border border-border-default bg-surface-1 p-0 shadow-xl"
        data-testid="provider-selector-dropdown"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {loading && (
          <div className="space-y-2 p-3" data-testid="provider-selector-loading">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 w-full animate-pulse rounded bg-surface-2" />
            ))}
          </div>
        )}

        {!loading && providers.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-4 text-center text-sm text-text-secondary">
            <Sparkles className="size-4 text-text-tertiary" />
            <p>暂无可选模型</p>
            <p className="text-[11px] text-text-tertiary">请在管理后台配置并启用对话模型</p>
            {onRetry && (
              <button
                type="button"
                data-testid="provider-selector-retry"
                className="text-xs text-brand-blue hover:underline"
                onClick={() => onRetry()}
              >
                重新加载
              </button>
            )}
          </div>
        )}

        {!loading && providers.length > 0 && (
          <div role="listbox" aria-label="选择对话模型" className="max-h-72 overflow-y-auto py-1">
            {providers.map((p) => {
              const isSelected = p.key === selectedKey
              return (
                <button
                  key={p.key}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-testid="provider-selector-item"
                  data-provider-key={p.key}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                    'text-text-primary hover:bg-surface-2',
                    isSelected && 'bg-brand-primary/5 hover:bg-brand-primary/10',
                  )}
                  // 防止 mousedown 抢焦点导致 Popover 先关、click 丢失
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePick(p.key)}
                >
                  <BotIcon className="size-4 shrink-0 text-text-secondary" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{p.model}</span>
                    <span className="truncate text-[11px] text-text-tertiary">
                      {p.name}
                      {p.isBuiltin ? ' · 官方' : ''}
                    </span>
                  </div>
                  {isSelected && (
                    <CheckIcon className="size-4 shrink-0 text-brand-primary" aria-hidden />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
