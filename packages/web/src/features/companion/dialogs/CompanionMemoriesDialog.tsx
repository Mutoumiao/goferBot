/**
 * 记忆库 — 工作台档弹层；单条变更不关层。
 *
 * 布局对齐原全页：左列表 + 右详情（选中时），避免弹层内再套多余顶栏/窄列 Tabs 折行错乱。
 */
import { Brain, Clock, Pencil, Star, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { CompanionStatusTag } from '../components/CompanionStatusTag'
import {
  canSaveMemoryEdit,
  filterMemoriesByType,
  MEMORY_FILTER_OPTIONS,
  nextMemoryToggleStatus,
  removeMemoryFromList,
  replaceMemoryInList,
} from '../memory-ui'
import { deleteMemory, getCompanion, listMemories, updateMemory } from '../services'
import { type Companion, MEMORY_TYPE_LABELS, type Memory, type MemoryFilter } from '../types'
import { CompanionPanelShell } from './companion-panel-shell'

export type CompanionMemoriesDialogProps = {
  companionId: string
  onSuccess?: () => void | Promise<void>
  onClose?: (result?: unknown) => void
}

export default function CompanionMemoriesDialog({
  companionId,
  onSuccess,
  onClose,
}: CompanionMemoriesDialogProps) {
  const [companion, setCompanion] = useState<Companion | null>(null)
  const [memories, setMemories] = useState<Memory[]>([])
  const [filter, setFilter] = useState<MemoryFilter>('all')
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [busy, setBusy] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [companionRes, memoriesRes] = await Promise.all([
        getCompanion(companionId).send(),
        listMemories(companionId).send(),
      ])
      setCompanion(companionRes)
      setMemories(memoriesRes.items ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载失败')
    } finally {
      setIsLoading(false)
    }
  }, [companionId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredMemories = filterMemoriesByType(memories, filter)

  const notifyChanged = async () => {
    await onSuccess?.()
  }

  const handleSelect = (memory: Memory) => {
    setSelectedMemory(memory)
    setEditing(false)
    setEditContent(memory.content)
  }

  const handleSaveEdit = async () => {
    if (!selectedMemory || !canSaveMemoryEdit(editContent)) return
    setBusy(true)
    try {
      const updated = await updateMemory(selectedMemory.id, {
        content: editContent.trim(),
      }).send()
      setMemories((prev) => replaceMemoryInList(prev, { ...selectedMemory, ...updated }))
      setSelectedMemory({ ...selectedMemory, ...updated })
      setEditing(false)
      toast.success('已更新记忆')
      await notifyChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '更新失败')
    } finally {
      setBusy(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!selectedMemory) return
    const next = nextMemoryToggleStatus(selectedMemory.status)
    setBusy(true)
    try {
      const updated = await updateMemory(selectedMemory.id, { status: next }).send()
      setMemories((prev) => replaceMemoryInList(prev, { ...selectedMemory, ...updated }))
      setSelectedMemory({ ...selectedMemory, ...updated })
      toast.success(next === 'active' ? '已启用' : '已停用')
      await notifyChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedMemory) return
    setBusy(true)
    try {
      await deleteMemory(selectedMemory.id).send()
      setMemories((prev) => removeMemoryFromList(prev, selectedMemory.id))
      setSelectedMemory(null)
      setEditing(false)
      toast.success('已删除记忆')
      await notifyChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <CompanionPanelShell
      tier="workspace"
      title={companion ? `${companion.name} 的记忆库` : '记忆库'}
      description={
        companion
          ? `共 ${memories.length} 条记忆 · ${companion.status === 'published' ? '已发布' : companion.status}`
          : undefined
      }
      onClose={onClose}
      contentClassName="min-h-0 overflow-hidden p-0"
    >
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : !companion ? (
        <div className="flex flex-1 items-center justify-center py-12">
          <Empty>
            <EmptyContent>
              <EmptyTitle>伴侣不存在</EmptyTitle>
              <EmptyDescription>请关闭后重新选择伴侣</EmptyDescription>
            </EmptyContent>
          </Empty>
        </div>
      ) : (
        <div
          className="flex min-h-0 flex-1 flex-col md:flex-row"
          data-testid="companion-memories-body"
        >
          {/* 列表区 */}
          <div
            className={cn(
              'flex min-h-0 min-w-0 flex-col border-border-subtle',
              selectedMemory ? 'md:w-[min(55%,28rem)] md:border-r' : 'flex-1',
            )}
          >
            <div className="shrink-0 border-b border-border-subtle px-3 py-2">
              <div className="mb-2 flex items-center gap-2 px-1">
                <CompanionStatusTag status={companion.status} />
                <span className="text-xs text-muted-foreground">筛选类型</span>
              </div>
              {/* 横向滚动，禁止 wrap 把 Tabs 挤乱 */}
              <Tabs value={filter} onValueChange={(v) => setFilter(v as MemoryFilter)}>
                <div className="overflow-x-auto pb-0.5">
                  <TabsList className="inline-flex h-9 w-max max-w-none flex-nowrap gap-0.5">
                    {MEMORY_FILTER_OPTIONS.map((opt) => (
                      <TabsTrigger
                        key={opt.value}
                        value={opt.value}
                        className="shrink-0 px-2.5 text-xs"
                      >
                        {opt.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </Tabs>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {filteredMemories.length === 0 ? (
                <Empty className="py-12">
                  <EmptyContent>
                    <EmptyTitle>暂无记忆</EmptyTitle>
                    <EmptyDescription>先去聊天积累一些美好时光吧</EmptyDescription>
                  </EmptyContent>
                </Empty>
              ) : (
                <ul className="space-y-2">
                  {filteredMemories.map((memory) => {
                    const active = selectedMemory?.id === memory.id
                    return (
                      <li key={memory.id}>
                        <button
                          type="button"
                          className={cn(
                            'w-full rounded-xl border p-3 text-left transition-colors',
                            active
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                              : 'border-border-subtle hover:bg-muted/60',
                          )}
                          onClick={() => handleSelect(memory)}
                          data-testid={`memory-item-${memory.id}`}
                        >
                          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px]">
                              {MEMORY_TYPE_LABELS[memory.type] ?? memory.type}
                            </Badge>
                            <Badge
                              variant={memory.status === 'active' ? 'default' : 'destructive'}
                              className="text-[10px]"
                            >
                              {memory.status === 'active' ? '启用' : '停用'}
                            </Badge>
                            <span className="ml-auto flex items-center gap-0.5 text-muted-foreground">
                              {(['s1', 's2', 's3', 's4', 's5'] as const).map((starKey, i) => (
                                <Star
                                  key={`${memory.id}-${starKey}`}
                                  className={cn(
                                    'h-3 w-3',
                                    i < (memory.importance ?? 0)
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-muted-foreground/25',
                                  )}
                                />
                              ))}
                            </span>
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-foreground/90">
                            {memory.content}
                          </p>
                          {memory.updatedAt && (
                            <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{new Date(memory.updatedAt).toLocaleDateString()}</span>
                            </div>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* 详情区：仅选中时展示，避免空右侧挤布局 */}
          {selectedMemory ? (
            <aside
              className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-border-subtle md:border-t-0"
              data-testid="memory-detail-panel"
            >
              <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle px-4 py-3">
                <Brain className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">记忆详情</h3>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                <div>
                  <Badge variant="secondary" className="mb-2">
                    {MEMORY_TYPE_LABELS[selectedMemory.type] ?? selectedMemory.type}
                  </Badge>
                  {editing ? (
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={6}
                      className="mt-1 resize-y"
                    />
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedMemory.content}
                    </p>
                  )}
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div>状态：{selectedMemory.status === 'active' ? '启用' : '停用'}</div>
                  <div>
                    重要度：
                    {'★'.repeat(Math.max(0, Math.min(5, selectedMemory.importance ?? 0))) || '—'}
                  </div>
                  {selectedMemory.updatedAt && (
                    <div>更新：{new Date(selectedMemory.updatedAt).toLocaleString()}</div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {editing ? (
                    <>
                      <Button
                        size="sm"
                        disabled={busy || !canSaveMemoryEdit(editContent)}
                        onClick={() => void handleSaveEdit()}
                      >
                        保存
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(false)
                          setEditContent(selectedMemory.content)
                        }}
                      >
                        取消
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setEditing(true)
                        setEditContent(selectedMemory.content)
                      }}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      编辑
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void handleToggleStatus()}
                  >
                    {selectedMemory.status === 'active' ? '停用' : '启用'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => void handleDelete()}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    删除
                  </Button>
                </div>
              </div>
            </aside>
          ) : (
            <div className="hidden min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground md:flex">
              选择左侧一条记忆查看详情
            </div>
          )}
        </div>
      )}
    </CompanionPanelShell>
  )
}
