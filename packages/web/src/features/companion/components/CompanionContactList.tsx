import { Heart, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { type CSSProperties, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/utils/cn'
import type { Companion } from '../types'
import { CompanionStatusTag } from './CompanionStatusTag'

export type CompanionListTab = 'official' | 'mine'

export interface CompanionContactListProps {
  companions: Companion[]
  selectedId: string | null
  tab: CompanionListTab
  loading?: boolean
  onTabChange: (tab: CompanionListTab) => void
  onSelect: (id: string) => void
  onCreate: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  className?: string
}

function avatarStyle(c: Companion): CSSProperties | undefined {
  if (c.avatarUrl) {
    return { backgroundImage: `url(${c.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  if (c.avatarKey) {
    return {
      backgroundImage: `url(/api/files/${c.avatarKey})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  return undefined
}

export function CompanionContactList({
  companions,
  selectedId,
  tab,
  loading,
  onTabChange,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
  className,
}: CompanionContactListProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return companions
    return companions.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.headline ?? '').toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q),
    )
  }, [companions, query])

  return (
    <aside
      className={cn(
        'flex h-full w-full flex-col border-r border-border-panel bg-surface-1',
        className,
      )}
      data-testid="companion-contact-list"
    >
      <div className="border-b border-border-subtle px-4 pb-3 pt-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-text-primary">AI 伴侣</h2>
            <p className="mt-0.5 text-[11px] text-text-tertiary">像聊天一样选择联系人</p>
          </div>
          {tab === 'mine' && (
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1 rounded-lg bg-brand-blue px-2.5 text-white shadow-sm hover:bg-brand-blue/90"
              onClick={onCreate}
              data-testid="companion-create-btn"
            >
              <Plus className="h-4 w-4" />
              新建
            </Button>
          )}
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => onTabChange(v as CompanionListTab)}
          className="mt-3"
        >
          <TabsList className="grid w-full grid-cols-2 bg-surface-3">
            <TabsTrigger value="official" data-testid="companion-tab-official">
              官方推荐
            </TabsTrigger>
            <TabsTrigger value="mine" data-testid="companion-tab-mine">
              我的伴侣
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-1 px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 shrink-0 text-text-tertiary" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索伴侣"
            aria-label="搜索伴侣"
            className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {loading && (
          <div className="space-y-2 px-1" data-testid="companion-list-loading">
            {[1, 2, 3, 4, 5].map((k) => (
              <SkeletonRow key={k} />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="px-3 py-14 text-center" data-testid="companion-list-empty">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-1 text-text-tertiary shadow-sm ring-1 ring-border-subtle">
              <Heart className="h-5 w-5" />
            </div>
            <p className="mt-4 text-sm font-medium text-text-primary">
              {tab === 'official' ? '暂无官方推荐' : '暂无自定义伴侣'}
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              {tab === 'official'
                ? '平台尚未发布内置伴侣'
                : '点击右上角新建，创建你的专属伴侣'}
            </p>
            {tab === 'mine' && (
              <Button
                type="button"
                size="sm"
                className="mt-4 gap-1"
                variant="outline"
                onClick={onCreate}
              >
                <Plus className="h-4 w-4" />
                新建伴侣
              </Button>
            )}
            {tab === 'official' && (
              <Button
                type="button"
                size="sm"
                className="mt-4"
                variant="outline"
                onClick={() => onTabChange('mine')}
              >
                去「我的伴侣」
              </Button>
            )}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <ul className="space-y-0.5" data-testid="companion-contact-items">
            {filtered.map((c) => {
              const active = c.id === selectedId
              const canManage = c.source !== 'system'
              return (
                <li key={c.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-all',
                      active
                        ? 'bg-surface-1 shadow-sm ring-1 ring-brand-blue/20'
                        : 'hover:bg-surface-1/80',
                    )}
                    aria-current={active ? 'true' : undefined}
                    data-testid={`companion-contact-${c.id}`}
                    data-active={active ? 'true' : undefined}
                  >
                    <div
                      className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white',
                        active ? 'bg-brand-blue' : 'bg-slate-400',
                      )}
                      style={avatarStyle(c)}
                    >
                      {!c.avatarUrl && !c.avatarKey && c.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'truncate text-sm',
                            active ? 'font-semibold text-brand-blue' : 'font-medium text-text-primary',
                          )}
                        >
                          {c.name}
                        </span>
                        {!canManage && (
                          <span className="shrink-0 rounded bg-brand-blue-soft px-1 py-px text-[10px] font-medium text-brand-blue">
                            官方
                          </span>
                        )}
                        {canManage && <CompanionStatusTag status={c.status} />}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-text-tertiary">
                        {c.headline || c.description || '点击开始对话'}
                      </p>
                    </div>
                  </button>

                  {canManage && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary hover:bg-surface-3"
                            aria-label="伴侣操作"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              onEdit(c.id)
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDelete(c.id)
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            归档
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-xl px-2.5 py-2.5">
      <Skeleton className="h-11 w-11 shrink-0 rounded-full bg-surface-3" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-24 rounded bg-surface-3" />
        <Skeleton className="h-3 w-36 rounded bg-surface-3" />
      </div>
    </div>
  )
}
