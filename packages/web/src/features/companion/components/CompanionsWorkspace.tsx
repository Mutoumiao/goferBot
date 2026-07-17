/**
 * 微信 PC 式伴侣工作台：左侧联系人列表 + 右侧聊天区。
 * 选中态存 companionStore.selectedCompanionId，不依赖 /companions/:id/chat 路由。
 *
 * 列表请求纪律（keep-alive 友好）：
 * 1. 仅在页面 isActive 时请求，未进入 /companions 不发 companions API
 * 2. 按 tab 本地缓存列表，切 tab 立即展示缓存，禁止单数组覆盖导致另一 tab 变空
 * 3. 二次请求无感：已有缓存时不 loading / 不骨架，静默覆盖
 * 4. 首进某 tab 且无缓存时才展示 loading
 */
import { useResponsive } from 'ahooks'
import { Heart, PanelLeft } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
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
import { useKeepAliveActive } from '@/lib/route-keepalive'
import { cn } from '@/utils/cn'
import {
  openCompanionCreateDialog,
  openCompanionEditDialog,
} from '../dialogs/open-companion-dialogs'
import { deleteCompanion, listCompanions } from '../services'
import { useCompanionStore } from '../store'
import type { Companion } from '../types'
import { CompanionChatPage } from './CompanionChatPage'
import { CompanionContactList, type CompanionListTab } from './CompanionContactList'

type TabListCache = {
  items: Companion[]
  /** 至少成功拉过一次 */
  hydrated: boolean
}

function emptyTabCache(): Record<CompanionListTab, TabListCache> {
  return {
    official: { items: [], hydrated: false },
    mine: { items: [], hydrated: false },
  }
}

export function CompanionsWorkspace() {
  const responsive = useResponsive()
  const isWide = Boolean(responsive.large)
  const isActive = useKeepAliveActive()

  const selectedId = useCompanionStore((s) => s.selectedCompanionId)
  const selectCompanion = useCompanionStore((s) => s.selectCompanion)
  const upsertCompanion = useCompanionStore((s) => s.upsertCompanion)
  const removeCompanion = useCompanionStore((s) => s.removeCompanion)
  const setError = useCompanionStore((s) => s.setError)

  const silentRefreshList = useCallback(
    async (targetTab: CompanionListTab) => {
      if (!isActiveRef.current) return
      try {
        const res = await listCompanions({ tab: targetTab }).send()
        const items = res.items ?? []
        cacheByTabRef.current[targetTab] = { items, hydrated: true }
        for (const c of items) upsertCompanion(c)
        if (tabRef.current === targetTab && isActiveRef.current) {
          setListItems(items)
        }
      } catch {
        /* 无感失败：保留缓存 */
      }
    },
    [upsertCompanion],
  )

  const [tab, setTab] = useState<CompanionListTab>('official')
  const [listItems, setListItems] = useState<Companion[]>([])
  /** 仅首屏无缓存时为 true；无感刷新绝不为 true */
  const [blockingLoading, setBlockingLoading] = useState(false)
  const [listOpen, setListOpen] = useState(true)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const tabRef = useRef(tab)
  tabRef.current = tab
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive
  const cacheByTabRef = useRef(emptyTabCache())
  /**
   * 仅在离开页面时递增：丢弃「页面已隐藏后」的响应。
   * 切 tab 不递增——后台返回的数据仍写入对应 tab 缓存，切回即可用。
   */
  const pageEpochRef = useRef(0)

  const loadCompanionsRef = useRef(async (_target: CompanionListTab) => {})
  loadCompanionsRef.current = async (targetTab) => {
    // 发起时必须在页内；中途切 tab 仍允许写缓存
    if (!isActiveRef.current) return

    const epoch = pageEpochRef.current
    const cached = cacheByTabRef.current[targetTab]
    const showBlocking = !cached.hydrated && cached.items.length === 0
    if (showBlocking && tabRef.current === targetTab) {
      setBlockingLoading(true)
    }

    try {
      const res = await listCompanions({ tab: targetTab }).send()
      // 已离开伴侣页（保活隐藏）则丢弃
      if (pageEpochRef.current !== epoch) return

      const items = res.items ?? []
      cacheByTabRef.current[targetTab] = { items, hydrated: true }
      for (const c of items) {
        upsertCompanion(c)
      }
      // 仅当前展示 tab 才刷新 UI
      if (tabRef.current === targetTab && isActiveRef.current) {
        setListItems(items)
      }
    } catch (e) {
      if (pageEpochRef.current !== epoch) return
      if (tabRef.current !== targetTab || !isActiveRef.current) return
      const msg = e instanceof Error ? e.message : '加载伴侣列表失败'
      setError(msg)
      toast.error(msg)
    } finally {
      if (tabRef.current === targetTab && isActiveRef.current) {
        setBlockingLoading(false)
      }
    }
  }

  // 激活 / 切 tab：先铺缓存，再请求（有缓存=无感覆盖）
  useEffect(() => {
    if (!isActive) return
    const cached = cacheByTabRef.current[tab]
    setListItems(cached.items)
    setBlockingLoading(!cached.hydrated && cached.items.length === 0)
    void loadCompanionsRef.current(tab)
  }, [isActive, tab])

  // 离开保活页：抬 epoch，丢弃在途写回；缓存保留供下次激活秒开
  useEffect(() => {
    if (!isActive) {
      pageEpochRef.current += 1
      setBlockingLoading(false)
    }
  }, [isActive])

  /**
   * 新建伴侣后：null → 有选中，且当前列表没有该项时，切到「我的」并补拉。
   * 禁止在「已选中但仍不在列表」时反复 force。
   */
  const prevSelectedIdRef = useRef<string | null>(selectedId)
  useEffect(() => {
    if (!isActive) return
    const prev = prevSelectedIdRef.current
    prevSelectedIdRef.current = selectedId
    if (!(!prev && selectedId)) return
    if (listItems.some((c) => c.id === selectedId)) return
    if (cacheByTabRef.current.mine.items.some((c) => c.id === selectedId)) {
      setTab('mine')
      return
    }
    if (tab !== 'mine') {
      setTab('mine')
      return
    }
    void loadCompanionsRef.current('mine')
  }, [selectedId, listItems, tab, isActive])

  useEffect(() => {
    if (!isWide) {
      setListOpen(!selectedId)
    } else {
      setListOpen(true)
    }
  }, [isWide, selectedId])

  const handleSelect = useCallback(
    (id: string) => {
      selectCompanion(id)
      if (!isWide) setListOpen(false)
    },
    [selectCompanion, isWide],
  )

  function handleCreate() {
    void openCompanionCreateDialog({
      onSuccess: async (companion) => {
        upsertCompanion(companion)
        selectCompanion(companion.id)
        setTab('mine')
        await silentRefreshList('mine')
      },
    })
  }

  const handleEdit = useCallback(
    (id: string) => {
      void openCompanionEditDialog({
        companionId: id,
        onSuccess: async (companion) => {
          upsertCompanion(companion)
          await silentRefreshList(tabRef.current)
        },
      })
    },
    [silentRefreshList, upsertCompanion],
  )

  const handleDelete = useCallback(async () => {
    if (!deleteTargetId) return
    try {
      await deleteCompanion(deleteTargetId).send()
      removeCompanion(deleteTargetId)
      const next = cacheByTabRef.current[tab].items.filter((c) => c.id !== deleteTargetId)
      cacheByTabRef.current[tab] = { items: next, hydrated: true }
      setListItems(next)
      if (useCompanionStore.getState().selectedCompanionId === deleteTargetId) {
        selectCompanion(null)
      }
      toast.success('已归档')
    } catch (e) {
      const msg = e instanceof Error ? e.message : '归档失败'
      setError(msg)
      toast.error(msg)
    } finally {
      setDeleteTargetId(null)
    }
  }, [deleteTargetId, removeCompanion, selectCompanion, setError, tab])

  function handleClearSelection() {
    selectCompanion(null)
    if (!isWide) setListOpen(true)
  }

  return (
    <div
      className="relative flex h-full min-h-0 overflow-hidden bg-transparent"
      data-testid="companions-workspace"
    >
      {!isWide && listOpen && (
        <button
          type="button"
          className="absolute inset-0 z-20 bg-slate-900/40 backdrop-blur-[1px]"
          aria-label="关闭联系人列表"
          onClick={() => setListOpen(false)}
        />
      )}

      <div
        className={cn(
          'z-30 h-full shrink-0 transition-[width,transform] duration-200 ease-out',
          isWide
            ? listOpen
              ? 'w-[300px]'
              : 'w-0 overflow-hidden'
            : cn(
                'absolute inset-y-0 left-0 w-[min(300px,88vw)] shadow-2xl shadow-slate-900/15',
                listOpen ? 'translate-x-0' : '-translate-x-full',
              ),
        )}
      >
        <CompanionContactList
          companions={listItems}
          selectedId={selectedId}
          tab={tab}
          loading={blockingLoading}
          onTabChange={setTab}
          onSelect={handleSelect}
          onCreate={handleCreate}
          onEdit={handleEdit}
          onDelete={(id) => setDeleteTargetId(id)}
          className="w-full"
        />
      </div>

      <div className="relative min-w-0 flex-1 bg-surface-1">
        {!listOpen && (
          <div className="absolute left-3 top-3 z-10">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9 rounded-xl border-border-default bg-surface-1 shadow-sm"
              onClick={() => setListOpen(true)}
              title="展开联系人"
              aria-label="展开联系人"
              data-testid="open-companion-list"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        {selectedId ? (
          <CompanionChatPage companionId={selectedId} embedded onBack={handleClearSelection} />
        ) : (
          <CompanionEmptyPane onCreate={handleCreate} showCreate={tab === 'mine'} />
        )}
      </div>

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
            <AlertDialogAction variant="destructive" onClick={() => void handleDelete()}>
              归档
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CompanionEmptyPane({
  onCreate,
  showCreate,
}: {
  onCreate: () => void
  showCreate: boolean
}) {
  return (
    <div
      className="gofer-mesh-bg relative flex h-full flex-col items-center justify-center px-6"
      data-testid="companion-empty-pane"
    >
      <div className="rounded-2xl border border-border-subtle bg-surface-1/95 px-10 py-12 text-center shadow-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue-soft text-brand-blue">
          <Heart className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-text-primary">选择一位伴侣开始聊天</h3>
        <p className="mt-2 max-w-xs text-sm text-text-secondary">
          左侧是联系人列表，点选后即可像微信一样在右侧对话
        </p>
        {showCreate && (
          <Button
            type="button"
            className="mt-5 gap-1 bg-brand-blue text-white hover:bg-brand-blue/90"
            onClick={onCreate}
          >
            新建伴侣
          </Button>
        )}
      </div>
    </div>
  )
}
