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
import { CompanionCard } from './CompanionCard'

type ListTab = 'official' | 'mine'

export function CompanionListPage() {
  const navigate = useNavigate()
  const { companions, isLoading, setCompanions, setIsLoading, setError, removeCompanion } =
    useCompanionStore()

  const [tab, setTab] = useState<ListTab>('official')
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const fetchCompanions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await listCompanions({ tab }).send()
      setCompanions(res.items ?? [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : '加载伴侣列表失败'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }, [tab, setCompanions, setIsLoading, setError])

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
      toast.success('已归档')
    } catch (e) {
      const msg = e instanceof Error ? e.message : '归档失败'
      setError(msg)
      toast.error(msg)
    } finally {
      setDeleteTargetId(null)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as ListTab)}>
          <TabsList>
            <TabsTrigger value="official">官方推荐</TabsTrigger>
            <TabsTrigger value="mine">我的伴侣</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === 'mine' && (
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-1" />
            新建伴侣
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : companions.length === 0 ? (
        <Empty className="py-16">
          <EmptyContent>
            {tab === 'official' ? (
              <>
                <EmptyTitle>暂无官方推荐</EmptyTitle>
                <EmptyDescription>平台尚未发布内置伴侣，可前往「我的伴侣」创建自定义</EmptyDescription>
                <Button
                  onClick={() => {
                    setTab('mine')
                  }}
                >
                  去「我的伴侣」
                </Button>
              </>
            ) : (
              <>
                <EmptyTitle>暂无自定义伴侣</EmptyTitle>
                <EmptyDescription>用简表快速创建一个专属伴侣</EmptyDescription>
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-1" />
                  新建伴侣
                </Button>
              </>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {companions.map((companion) => (
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
            <AlertDialogTitle>确认归档</AlertDialogTitle>
            <AlertDialogDescription>
              归档后将从「我的伴侣」列表隐藏，会话数据保留。本期不提供恢复入口。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTargetId(null)}>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              归档
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
