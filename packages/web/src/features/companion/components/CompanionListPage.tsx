import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { deleteCompanion, listCompanions } from '../services'
import { useCompanionStore } from '../store'
import type { CompanionStatus } from '../types'
import { CompanionCard } from './CompanionCard'

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' },
]

type StatusFilter = (typeof STATUS_FILTERS)[number]['value']

export function CompanionListPage() {
  const navigate = useNavigate()
  const { companions, isLoading, setCompanions, setIsLoading, setError, removeCompanion } =
    useCompanionStore()

  const [filter, setFilter] = useState<StatusFilter>('all')
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const fetchCompanions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = filter === 'all' ? undefined : { status: filter as CompanionStatus }
      const res = await listCompanions(params).send()
      setCompanions(res.items ?? [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : '加载伴侣列表失败'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }, [filter, setCompanions, setIsLoading, setError])

  useEffect(() => {
    fetchCompanions()
  }, [fetchCompanions])

  const handleSelect = (id: string) => {
    navigate({
      to: '/companions/$companionId/chat',
      params: { companionId: id },
    })
  }

  const handleEdit = (id: string) => {
    navigate({
      to: '/companions/$companionId/edit',
      params: { companionId: id },
    })
  }

  const handleCreate = () => {
    navigate({ to: '/companions/new' })
  }

  const handleDelete = async () => {
    if (!deleteTargetId) return
    try {
      await deleteCompanion(deleteTargetId).send()
      removeCompanion(deleteTargetId)
      toast.success('删除成功')
    } catch (e) {
      const msg = e instanceof Error ? e.message : '删除失败'
      setError(msg)
      toast.error(msg)
    } finally {
      setDeleteTargetId(null)
    }
  }

  const filteredCompanions =
    filter === 'all' ? companions : companions.filter((c) => c.status === filter)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
          <TabsList>
            {STATUS_FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-1" />
          新建伴侣
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : filteredCompanions.length === 0 ? (
        <Empty className="py-16">
          <EmptyContent>
            <EmptyTitle>暂无伴侣</EmptyTitle>
            <EmptyDescription>
              {filter === 'all' ? '点击上方按钮创建第一个伴侣' : '该状态下暂无伴侣'}
            </EmptyDescription>
            {filter === 'all' && (
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-1" />
                新建伴侣
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCompanions.map((companion) => (
            <CompanionCard
              key={companion.id}
              companion={companion}
              onSelect={handleSelect}
              onEdit={handleEdit}
              onDelete={(id) => setDeleteTargetId(id)}
            />
          ))}
        </div>
      )}

      <AlertDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>删除后无法恢复，是否继续？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTargetId(null)}>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
