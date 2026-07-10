import type { ChatSourceItem } from '@goferbot/data'
import { BookOpenIcon, FileTextIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

interface SourceCitationsProps {
  sources?: ChatSourceItem[]
  retrievalEmpty?: boolean
  className?: string
}

/** Group sources by kb_id for multi-KB display. */
function groupByKb(sources: ChatSourceItem[]): Map<string, ChatSourceItem[]> {
  const map = new Map<string, ChatSourceItem[]>()
  for (const s of sources) {
    const key = s.kb_id || 'unknown'
    const list = map.get(key) ?? []
    list.push(s)
    map.set(key, list)
  }
  return map
}

export function SourceCitations({ sources, retrievalEmpty, className }: SourceCitationsProps) {
  if (retrievalEmpty) {
    return (
      <div
        className={cn(
          'mt-2 rounded-lg border border-border-default bg-surface-2/60 px-3 py-2 text-xs text-text-secondary',
          className,
        )}
        data-testid="sources-empty"
      >
        未检索到相关资料（retrieval empty）
      </div>
    )
  }

  if (!sources?.length) return null

  const groups = groupByKb(sources)

  return (
    <div
      className={cn('mt-2 space-y-2', className)}
      data-testid="sources-panel"
    >
      <div className="flex items-center gap-1 text-xs font-medium text-text-secondary">
        <BookOpenIcon className="size-3.5" />
        <span>引用来源（{sources.length}）</span>
      </div>
      {[...groups.entries()].map(([kbId, items]) => (
        <div
          key={kbId}
          className="rounded-lg border border-border-default bg-surface-2/50 px-3 py-2"
          data-testid="sources-kb-group"
          data-kb-id={kbId}
        >
          <div className="mb-1 truncate text-[11px] text-text-tertiary" title={kbId}>
            知识库 · {kbId.slice(0, 8)}…
          </div>
          <ul className="space-y-1.5">
            {items.map((s, idx) => (
              <li
                key={`${s.document_id}-${s.chunk_id ?? idx}`}
                className="flex gap-2 text-xs text-text-primary"
                data-testid="source-item"
              >
                <FileTextIcon className="mt-0.5 size-3.5 shrink-0 text-text-secondary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] text-text-tertiary">
                    文档 {s.document_id.slice(0, 8)}…
                    {typeof s.score === 'number' ? ` · score ${s.score.toFixed(3)}` : ''}
                  </div>
                  {s.content ? (
                    <p className="line-clamp-2 text-text-secondary">{s.content}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
