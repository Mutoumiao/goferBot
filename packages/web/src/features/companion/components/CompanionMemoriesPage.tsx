import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Brain, Clock, MessageCircle, Star } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getCompanion, listMemories } from '../services'
import { type Companion, type Memory, MEMORY_TYPE_LABELS, type MemoryFilter } from '../types'
import { CompanionStatusTag } from './CompanionStatusTag'

interface CompanionMemoriesPageProps {
  companionId: string
}

const FILTER_OPTIONS: { value: MemoryFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'preference', label: '偏好' },
  { value: 'boundary', label: '边界' },
  { value: 'relationship_goal', label: '关系目标' },
  { value: 'conversation_style', label: '对话风格' },
  { value: 'important_fact', label: '重要事实' },
]

export function CompanionMemoriesPage({ companionId }: CompanionMemoriesPageProps) {
  const navigate = useNavigate()
  const [companion, setCompanion] = useState<Companion | null>(null)
  const [memories, setMemories] = useState<Memory[]>([])
  const [filter, setFilter] = useState<MemoryFilter>('all')
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
    loadData()
  }, [loadData])

  const filteredMemories = filter === 'all' ? memories : memories.filter((m) => m.type === filter)

  const handleBack = () => {
    navigate({
      to: '/companions/$companionId/chat',
      params: { companionId },
    })
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!companion) {
    return (
      <div className="flex h-full items-center justify-center">
        <Empty>
          <EmptyContent>
            <EmptyTitle>伴侣不存在</EmptyTitle>
            <EmptyDescription>请返回伴侣列表重新选择</EmptyDescription>
            <Button onClick={() => navigate({ to: '/companions' })}>返回列表</Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-3 p-4 border-b">
        <Button variant="ghost" size="icon" onClick={handleBack} aria-label="返回">
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div
          className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-base font-medium"
          style={{
            backgroundImage: companion.avatarKey
              ? `url(/api/files/${companion.avatarKey})`
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {!companion.avatarKey && companion.name.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-medium truncate">{companion.name} 的记忆库</h2>
            <CompanionStatusTag status={companion.status} />
          </div>
          <p className="text-sm text-muted-foreground">共 {memories.length} 条记忆</p>
        </div>

        <Button variant="outline" size="sm" onClick={handleBack}>
          <MessageCircle className="h-4 w-4 mr-1" />
          返回对话
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as MemoryFilter)}>
            <TabsList className="mb-4">
              {FILTER_OPTIONS.map((f) => (
                <TabsTrigger key={f.value} value={f.value}>
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {filteredMemories.length === 0 ? (
            <Empty className="py-16">
              <EmptyContent>
                <EmptyTitle>暂无记忆</EmptyTitle>
                <EmptyDescription>先去聊天积累一些美好时光吧</EmptyDescription>
                <Button onClick={handleBack}>开始对话</Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="space-y-3">
              {filteredMemories.map((memory) => (
                <div
                  key={memory.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedMemory?.id === memory.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => setSelectedMemory(memory)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary">{MEMORY_TYPE_LABELS[memory.type]}</Badge>
                        {memory.status === 'active' ? (
                          <Badge variant="default">启用</Badge>
                        ) : (
                          <Badge variant="destructive">停用</Badge>
                        )}
                      </div>
                      <p className="text-sm line-clamp-2">{memory.content}</p>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${
                            i < memory.importance
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-muted-foreground/30'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(memory.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedMemory && (
          <div className="w-80 border-l p-4 overflow-y-auto">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Brain className="h-4 w-4" />
              记忆详情
            </h3>
            <div className="space-y-4">
              <div>
                <Badge variant="secondary" className="mb-2">
                  {MEMORY_TYPE_LABELS[selectedMemory.type]}
                </Badge>
                <p className="text-sm leading-relaxed">{selectedMemory.content}</p>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>状态：{selectedMemory.status === 'active' ? '启用' : '停用'}</div>
                <div>重要度：{'★'.repeat(selectedMemory.importance)}</div>
                <div>更新时间：{new Date(selectedMemory.updatedAt).toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
