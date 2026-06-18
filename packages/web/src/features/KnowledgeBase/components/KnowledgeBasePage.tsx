import { useResponsive } from 'ahooks'
import { BookOpen, PanelLeftOpen } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchKbList } from '../services'
import { useKbStore } from '../store'
import { FileBrowser } from './FileBrowser'
import { KnowledgeBaseList } from './KnowledgeBaseList'

export function KnowledgeBasePage() {
  const { entries, selectedId } = useKbStore()
  const [kbListError, setKbListError] = useState<string | null>(null)

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const autoCollapsedRef = useRef(false)
  const responsive = useResponsive()

  useEffect(() => {
    if (autoCollapsedRef.current) return
    if (!responsive.large) {
      autoCollapsedRef.current = true
      setSidebarOpen(false)
    }
  }, [responsive.large])

  useEffect(() => {
    fetchKbList().then((result) => {
      if (!result.success) {
        setKbListError(result.error ?? '加载失败')
      }
    })
  }, [])

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev)
    if (autoCollapsedRef.current) {
      autoCollapsedRef.current = false
    }
  }, [])

  const handleRetryKbList = useCallback(() => {
    setKbListError(null)
    fetchKbList().then((result) => {
      if (!result.success) {
        setKbListError(result.error ?? '加载失败')
      }
    })
  }, [])

  const kbName = entries.find((e) => e.id === selectedId)?.name ?? 'Unknown'

  return (
    <div className="relative flex h-full overflow-hidden">
      <KnowledgeBaseList
        sidebarOpen={sidebarOpen}
        onToggle={handleToggleSidebar}
        loadError={kbListError}
        onRetry={handleRetryKbList}
      />

      <div className="flex flex-1 flex-col overflow-auto bg-surface-secondary p-4">
        {!selectedId ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <BookOpen className="mx-auto h-12 w-12 text-text-tertiary" />
              <h3 className="mt-4 text-lg font-medium text-text-primary">选择一个知识库</h3>
              <p className="mt-2 text-sm text-text-secondary">
                从左侧列表中选择一个知识库开始管理文档
              </p>
            </div>
          </div>
        ) : (
          <FileBrowser kbName={kbName} />
        )}
      </div>

      {!sidebarOpen && (
        <div className="absolute left-4 top-4 z-10">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E7EAF0] bg-white text-[#5E6673] shadow-sm transition-colors hover:bg-[#F7F8FA]"
            onClick={handleToggleSidebar}
            title="展开知识库列表"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
