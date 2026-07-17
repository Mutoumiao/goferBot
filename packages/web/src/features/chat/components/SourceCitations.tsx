import type { ChatSourceItem } from '@goferbot/data'
import { ChevronRight, FileTextIcon, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/utils/cn'

interface SourceCitationsProps {
  sources?: ChatSourceItem[]
  retrievalEmpty?: boolean
  className?: string
  /**
   * 打开文档列表时的回调（由会话区统一挂右上角浮层时使用）。
   * 未传则组件内自管浮层。
   */
  onOpenPanel?: (sources: ChatSourceItem[]) => void
  /** 父级托管浮层时的展开态（用于正确 aria-expanded） */
  panelOpen?: boolean
}

export interface SourceDocumentRow {
  documentId: string
  kbId: string
  chunkCount: number
  /** 暂无后端文件名时用短 id 占位 */
  label: string
}

/** 按 document_id 去重，仅保留文档级信息（不展开段落） */
export function uniqueSourceDocuments(sources: ChatSourceItem[]): SourceDocumentRow[] {
  const map = new Map<string, SourceDocumentRow>()
  for (const s of sources) {
    const existing = map.get(s.document_id)
    if (existing) {
      existing.chunkCount += 1
      continue
    }
    map.set(s.document_id, {
      documentId: s.document_id,
      kbId: s.kb_id,
      chunkCount: 1,
      label: formatDocumentLabel(s.document_id),
    })
  }
  return Array.from(map.values())
}

function formatDocumentLabel(documentId: string): string {
  const short = documentId.replace(/-/g, '').slice(0, 8)
  return `文档 ${short}`
}

/** 预览头像色：按 id 稳定取色 */
const DOC_DOT_COLORS = [
  'bg-sky-400',
  'bg-emerald-400',
  'bg-amber-400',
  'bg-violet-400',
  'bg-rose-400',
  'bg-cyan-400',
]

function docDotColor(id: string, index: number): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i) * (i + 1)) % 997
  return DOC_DOT_COLORS[(hash + index) % DOC_DOT_COLORS.length]
}

/**
 * 引用来源：默认紧凑一行「引用 N 篇资料…」，
 * 点击后由父级或内嵌浮层展示文档名列表（不展示段落正文）。
 */
export function SourceCitations({
  sources,
  retrievalEmpty,
  className,
  onOpenPanel,
  panelOpen,
}: SourceCitationsProps) {
  const [localOpen, setLocalOpen] = useState(false)

  const docs = useMemo(() => (sources?.length ? uniqueSourceDocuments(sources) : []), [sources])

  if (retrievalEmpty) {
    return (
      <div className={cn('mt-2 text-xs text-text-tertiary', className)} data-testid="sources-empty">
        未检索到相关资料
      </div>
    )
  }

  if (!docs.length) return null

  const preview = docs.slice(0, 3)
  const expanded = onOpenPanel ? Boolean(panelOpen) : localOpen

  const handleOpen = () => {
    if (onOpenPanel && sources) {
      onOpenPanel(sources)
      return
    }
    setLocalOpen((v) => !v)
  }

  return (
    <div className={cn('relative mt-2', className)} data-testid="sources-panel">
      <button
        type="button"
        onClick={handleOpen}
        className="group inline-flex max-w-full items-center gap-1.5 rounded-lg py-0.5 text-left text-xs text-text-secondary transition-colors hover:text-text-primary"
        data-testid="sources-trigger"
        aria-expanded={expanded}
        aria-haspopup="dialog"
      >
        <span>引用 {docs.length} 篇资料作为参考</span>
        <span className="inline-flex items-center -space-x-1" aria-hidden>
          {preview.map((d, i) => (
            <span
              key={d.documentId}
              className={cn(
                'inline-flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-surface-1',
                docDotColor(d.documentId, i),
              )}
            >
              <FileTextIcon className="h-2.5 w-2.5 text-white" />
            </span>
          ))}
        </span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" />
      </button>

      {/* 无外部托管时：就近弹出文档列表（仍不展示段落） */}
      {localOpen && !onOpenPanel && (
        <SourceDocsPopover
          docs={docs}
          onClose={() => setLocalOpen(false)}
          className="absolute left-0 top-full z-20 mt-2"
        />
      )}
    </div>
  )
}

/**
 * 会话工作区右上角文档列表浮层（由 ChatSessionView 挂载）。
 */
export function SourceDocsFloatingPanel({
  sources,
  onClose,
  className,
}: {
  sources: ChatSourceItem[]
  onClose: () => void
  className?: string
}) {
  const docs = useMemo(() => uniqueSourceDocuments(sources), [sources])
  if (!docs.length) return null
  return (
    <SourceDocsPopover
      docs={docs}
      onClose={onClose}
      className={cn('absolute right-4 top-4 z-30', className)}
      dataTestId="sources-floating-panel"
    />
  )
}

function SourceDocsPopover({
  docs,
  onClose,
  className,
  dataTestId = 'sources-docs-popover',
}: {
  docs: SourceDocumentRow[]
  onClose: () => void
  className?: string
  dataTestId?: string
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className={cn(
        'w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border-panel bg-surface-1 shadow-[0_8px_28px_rgba(31,35,41,0.12)]',
        className,
      )}
      data-testid={dataTestId}
      role="dialog"
      aria-modal="true"
      aria-label="参考文档列表"
    >
      <div className="flex items-center justify-between border-b border-border-panel px-3 py-2.5">
        <div>
          <p className="text-sm font-medium text-text-primary">参考文档</p>
          <p className="text-[11px] text-text-tertiary">共 {docs.length} 篇</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary hover:bg-surface-2 hover:text-text-secondary"
          aria-label="关闭参考文档"
          data-testid="sources-panel-close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="max-h-[min(360px,50vh)] overflow-y-auto p-1.5" data-testid="sources-doc-list">
        {docs.map((d, i) => (
          <li
            key={d.documentId}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2"
            data-testid="source-doc-item"
            data-document-id={d.documentId}
            title={d.documentId}
          >
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white',
                docDotColor(d.documentId, i),
              )}
            >
              <FileTextIcon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-text-primary">{d.label}</span>
              <span className="block truncate text-[11px] text-text-tertiary">
                {d.chunkCount > 1 ? `${d.chunkCount} 处命中` : '1 处命中'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
