import { useCallback } from 'react'
import { cn } from '@/utils/cn'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkspaceStore, type Tab } from '@/stores/workspace.store'
import { tabManager } from '@/stores/tabManager'
import { ROUTES_REGISTER } from '@/router-register'

export function TabBar({ className }: { className?: string }) {
  const tabs = useWorkspaceStore(s => s.tabs)
  const activeTabId = useWorkspaceStore(s => s.activeTabId)

  const handleTabClick = useCallback(
    (tab: Tab) => {
      if (tab.id === activeTabId) return
      void tabManager.switchTab(tab.id)
    },
    [activeTabId]
  )

  const handleTabClose = useCallback((tabId: string) => {
    void tabManager.closeTab(tabId)
  }, [])

  const handleNewTab = useCallback(() => {
    void tabManager.openNewChat()
  }, [])

  return (
    <div className={cn('flex h-13 items-center gap-1 bg-surface-secondary px-2 pt-1', className)}>
      {/* 标签区域 — 浏览器标签栏无滚动，超出时压缩显示 */}
      <div role="tablist" className="flex items-end gap-1 min-w-0 overflow-hidden">
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId
          const canClose = tab.closable
          const meta = ROUTES_REGISTER[tab.type]
          const Icon = meta?.icon ?? null

          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              data-active={isActive}
              className={cn(
                'group relative flex h-9 min-w-12 max-w-60 shrink items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] transition-colors cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'bg-surface-1 text-text-primary z-10'
                  : 'bg-surface-3 text-text-secondary hover:bg-surface-2 hover:text-text-primary'
              )}
              onClick={() => handleTabClick(tab)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleTabClick(tab)
                }
              }}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}

              <span className="flex-1 truncate" title={tab.title}>
                {tab.title}
              </span>

              {/* 关闭按钮 — 使用 div role="button" 避免嵌套 button */}
              {canClose && (
                <div
                  role="button"
                  tabIndex={-1}
                  aria-label={`关闭 ${tab.title}`}
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-text-tertiary transition-opacity hover:bg-surface-3 hover:text-text-primary',
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )}
                  onClick={e => {
                    e.stopPropagation()
                    handleTabClose(tab.id)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      handleTabClose(tab.id)
                    }
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 新建标签按钮 */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-md text-text-tertiary hover:bg-surface-2 hover:text-text-secondary"
        onClick={handleNewTab}
        title="新建问答会话"
        aria-label="新建问答会话"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}
