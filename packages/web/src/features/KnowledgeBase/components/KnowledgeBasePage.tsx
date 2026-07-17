import { useResponsive } from 'ahooks'
import { BookOpen, MessageSquare, PanelLeftOpen, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useKeepAliveSilentRefresh } from '@/lib/route-keepalive'
import { cn } from '@/utils/cn'
import { fetchKbList } from '../services'
import { useKbStore } from '../store'
import { FileBrowser } from './FileBrowser'
import { KbInlineChat } from './KbInlineChat'
import { KnowledgeBaseList } from './KnowledgeBaseList'
import { UploadMiniPanel } from './UploadMiniPanel'

/**
 * 知识库三栏：库列表 | 内容树 | 同屏问答。
 *
 * 桌面应用模型：
 * - 选中库用 kbStore.selectedId（不写 URL）
 * - KeepAlive 缓存整页；二次进入无感刷新库列表
 */
export function KnowledgeBasePage() {
  const { entries, selectedId } = useKbStore()
  const [kbListError, setKbListError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chatOpen, setChatOpen] = useState(true)
  const [mobilePanel, setMobilePanel] = useState<'files' | 'chat'>('files')
  const autoCollapsedRef = useRef(false)
  const responsive = useResponsive()
  const isWide = Boolean(responsive.large)

  useKeepAliveSilentRefresh(({ silent }) => {
    if (!silent) setKbListError(null)
    void fetchKbList({ silent }).then((result) => {
      if (!result.success) {
        setKbListError(result.error ?? '加载失败')
      } else if (silent) {
        setKbListError(null)
      }
    })
  })

  useEffect(() => {
    if (autoCollapsedRef.current) return
    if (!isWide) {
      autoCollapsedRef.current = true
      setSidebarOpen(false)
    }
  }, [isWide])

  function handleToggleSidebar() {
    setSidebarOpen((prev) => !prev)
    if (autoCollapsedRef.current) {
      autoCollapsedRef.current = false
    }
  }

  function handleRetryKbList() {
    setKbListError(null)
    fetchKbList().then((result) => {
      if (!result.success) {
        setKbListError(result.error ?? '加载失败')
      }
    })
  }

  const kbName = entries.find((e) => e.id === selectedId)?.name
  const showChat = Boolean(selectedId) && chatOpen

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden bg-transparent" data-testid="kb-page">
      <KnowledgeBaseList
        sidebarOpen={sidebarOpen}
        onToggle={handleToggleSidebar}
        loadError={kbListError}
        onRetry={handleRetryKbList}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface-1">
        {!sidebarOpen && (
          <div className="flex items-center gap-2 border-b border-border-panel bg-surface-1 px-4 py-2.5">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-default bg-surface-1 text-text-secondary shadow-sm transition-colors hover:bg-surface-3"
              onClick={handleToggleSidebar}
              title="展开知识库列表"
              aria-label="展开知识库列表"
              data-testid="kb-expand-list"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
            <span className="truncate text-sm font-semibold text-text-primary">
              {kbName ?? '知识库'}
            </span>
            {selectedId && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="ml-auto h-8 gap-1"
                onClick={() => setChatOpen((v) => !v)}
                data-testid="kb-toggle-chat"
              >
                <MessageSquare className="h-4 w-4" />
                {chatOpen ? '收起问答' : '库内问答'}
              </Button>
            )}
          </div>
        )}

        {selectedId && !isWide && (
          <div className="flex gap-1 border-b border-border-panel bg-surface-1 px-3 py-2">
            <Button
              size="sm"
              variant={mobilePanel === 'files' ? 'default' : 'ghost'}
              className="h-8"
              onClick={() => setMobilePanel('files')}
            >
              文件
            </Button>
            <Button
              size="sm"
              variant={mobilePanel === 'chat' ? 'default' : 'ghost'}
              className="h-8"
              onClick={() => setMobilePanel('chat')}
            >
              问答
            </Button>
          </div>
        )}

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div
            className={cn(
              'flex min-w-0 flex-col overflow-auto bg-surface-1 p-4',
              isWide
                ? showChat
                  ? 'flex-[1.2]'
                  : 'flex-1'
                : mobilePanel === 'files'
                  ? 'flex-1'
                  : 'hidden',
            )}
          >
            {!selectedId ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="rounded-2xl border border-dashed border-border-default bg-surface-1 px-10 py-12 text-center shadow-sm">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue-soft text-brand-blue">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-text-primary">选择一个知识库</h3>
                  <p className="mt-2 max-w-xs text-sm text-text-secondary">
                    从左侧列表中选择知识库，管理文档或开启同屏问答
                  </p>
                  {!sidebarOpen && (
                    <Button className="mt-5" variant="outline" onClick={handleToggleSidebar}>
                      展开列表
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {sidebarOpen && isWide && (
                  <div className="mb-3 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 border-border-default bg-surface-1 shadow-sm"
                      onClick={() => setChatOpen((v) => !v)}
                    >
                      <MessageSquare className="h-4 w-4" />
                      {chatOpen ? '收起问答' : '库内问答'}
                    </Button>
                  </div>
                )}
                <FileBrowser kbName={kbName ?? 'Unknown'} />
              </>
            )}
          </div>

          {selectedId && showChat && (isWide || mobilePanel === 'chat') && (
            <div
              className={cn(
                'relative min-w-0 border-l border-border-panel bg-surface-1',
                isWide ? 'w-[min(420px,40%)] shrink-0' : 'flex-1',
              )}
            >
              {isWide && (
                <button
                  type="button"
                  className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary hover:bg-surface-2"
                  onClick={() => setChatOpen(false)}
                  aria-label="关闭问答"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <KbInlineChat kbId={selectedId} kbName={kbName} />
            </div>
          )}
        </div>
      </div>

      <UploadMiniPanel />
    </div>
  )
}
