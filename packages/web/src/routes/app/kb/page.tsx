import { useEffect, useState, useCallback, useRef } from 'react'
import { useResponsive } from 'ahooks'
import { useKbStore } from '@/stores/kb'
import { useFileStore } from '@/stores/file'
import { BookOpen, PanelLeftOpen } from 'lucide-react'
import type { KbEntry } from '@goferbot/data'
import type { Folder, DocumentItem } from '@/stores/file'
import { Sidebar } from './Sidebar'
import { Main } from './Main'

/* ========== Mock 数据（仅用于静态预览，恢复真实接口时删除） ========== */

const MOCK_KB_ENTRIES: KbEntry[] = [
  {
    id: '1',
    name: '产品调研',
    description: '42 个文件 · 8 个会话引用',
    fileCount: 42,
    createdAt: '2024-04-01T00:00:00Z',
    updatedAt: '2024-04-12T16:30:00Z',
  },
  {
    id: '2',
    name: '技术文档',
    description: '18 个文件',
    fileCount: 18,
    createdAt: '2024-03-15T00:00:00Z',
    updatedAt: '2024-04-10T10:20:00Z',
  },
  {
    id: '3',
    name: '会议纪要',
    description: '27 个文件',
    fileCount: 27,
    createdAt: '2024-03-20T00:00:00Z',
    updatedAt: '2024-04-09T14:22:00Z',
  },
]

const MOCK_FOLDERS: Folder[] = [
  {
    id: 'f1',
    kbId: '1',
    parentId: null,
    name: 'docs',
    createdAt: '2024-04-12T16:30:00Z',
    updatedAt: '2024-04-12T16:30:00Z',
  },
  {
    id: 'f2',
    kbId: '1',
    parentId: null,
    name: '调研原始资料',
    createdAt: '2024-04-11T10:20:00Z',
    updatedAt: '2024-04-11T10:20:00Z',
  },
  {
    id: 'f3',
    kbId: '1',
    parentId: null,
    name: '会议纪要',
    createdAt: '2024-04-10T09:15:00Z',
    updatedAt: '2024-04-10T09:15:00Z',
  },
  {
    id: 'f4',
    kbId: '1',
    parentId: null,
    name: '竞品分析',
    createdAt: '2024-04-09T14:22:00Z',
    updatedAt: '2024-04-09T14:22:00Z',
  },
]

const MOCK_DOCUMENTS: DocumentItem[] = [
  {
    id: 'd1',
    kbId: '1',
    folderId: null,
    name: '产品调研.pdf',
    ext: 'pdf',
    mimeType: 'application/pdf',
    size: 2516582,
    status: 'ready',
    createdAt: '2024-04-12T15:45:00Z',
    updatedAt: '2024-04-12T15:45:00Z',
  },
  {
    id: 'd2',
    kbId: '1',
    folderId: null,
    name: '竞品网页摘录.xlsx',
    ext: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 159744,
    status: 'ready',
    createdAt: '2024-04-12T11:20:00Z',
    updatedAt: '2024-04-12T11:20:00Z',
  },
  {
    id: 'd3',
    kbId: '1',
    folderId: null,
    name: '机会点整理.pptx',
    ext: 'pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    size: 3670016,
    status: 'ready',
    createdAt: '2024-04-11T17:33:00Z',
    updatedAt: '2024-04-11T17:33:00Z',
  },
  {
    id: 'd4',
    kbId: '1',
    folderId: null,
    name: 'SKILL.md',
    ext: 'md',
    mimeType: 'text/markdown',
    size: 2355,
    status: 'ready',
    createdAt: '2024-04-12T15:45:00Z',
    updatedAt: '2024-04-12T15:45:00Z',
  },
]

/* ========== Mock API 包装（恢复真实接口时删除此对象，恢复原始导入） ========== */

const mockApi = {
  getKbList: () => ({
    send: async () => ({ data: { entries: MOCK_KB_ENTRIES } }),
  }),
  uploadFile: (_kbId: string, _formData: FormData) => ({
    send: () => Promise.resolve({ success: true }),
  }),
}

/* ========== 页面组件 ========== */

export function KbListPage() {
  const {
    entries,
    setEntries,
    setIsLoading: setKbLoading,
    selectedId,
  } = useKbStore()

  const {
    isLoading: fileLoading,
    error: fileError,
    breadcrumb,
  } = useFileStore()

  /* ========== 侧边栏展开/收起状态 ========== */
  const [sidebarOpen, setSidebarOpen] = useState(true)
  /**
   * autoCollapsedRef 记录侧边栏是否被响应式逻辑自动收起过。
   * 一旦自动收起，窗口再变宽也不会自动展开，
   * 只有用户手动点击展开按钮才会重新打开。
   */
  const autoCollapsedRef = useRef(false)

  // 使用 ahooks useResponsive 替代手动 resize 监听
  const responsive = useResponsive()

  useEffect(() => {
    if (autoCollapsedRef.current) return
    // large 对应 >= 1024px，非 large 即 < 1024px
    if (!responsive.large) {
      autoCollapsedRef.current = true
      setSidebarOpen(false)
    }
  }, [responsive.large])

  // Load KB list on mount — 使用 mock API
  const fetchList = useCallback(() => {
    setKbLoading(true)
    mockApi
      .getKbList()
      .send()
      .then(res => {
        const data = (res as { data?: { entries?: unknown[] } })?.data
        if (data?.entries) setEntries(data.entries as never[])
      })
      .catch((_err: unknown) => {
        // 错误处理：可接入 toast 或日志系统
      })
      .finally(() => setKbLoading(false))
  }, [setEntries, setKbLoading])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  // Load items when selectedId changes — 使用 mock 数据直接注入
  useEffect(() => {
    if (selectedId) {
      useFileStore.setState({
        folders: MOCK_FOLDERS,
        documents: MOCK_DOCUMENTS,
        currentKbId: selectedId,
        currentFolderId: null,
        isLoading: false,
        error: null,
      })
    }
  }, [selectedId])

  const kbName = entries.find(e => e.id === selectedId)?.name ?? 'Unknown'

  const handleBreadcrumbNavigate = useCallback(
    (folderId: string | null) => {
      if (selectedId) {
        if (folderId === null) {
          useFileStore.setState({
            currentFolderId: null,
            folders: MOCK_FOLDERS,
            documents: MOCK_DOCUMENTS,
          })
        }
      }
    },
    [selectedId]
  )

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev)
    if (autoCollapsedRef.current) {
      autoCollapsedRef.current = false
    }
  }, [])

  return (
    <div className="relative flex h-full overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} onToggle={handleToggleSidebar} />

      <div className="flex flex-1 flex-col overflow-auto bg-surface-secondary p-4">
        {!selectedId ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <BookOpen className="mx-auto h-12 w-12 text-text-tertiary" />
              <h3 className="mt-4 text-lg font-medium text-text-primary">选择一个知识库</h3>
              <p className="mt-2 text-sm text-text-secondary">从左侧列表中选择一个知识库开始管理文档</p>
            </div>
          </div>
        ) : (
          <Main
            fileLoading={fileLoading}
            fileError={fileError}
            kbName={kbName}
            breadcrumb={breadcrumb}
            onNavigate={handleBreadcrumbNavigate}
          />
        )}
      </div>

      {!sidebarOpen && (
        <div className="absolute left-4 top-4 z-10">
          <button
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
