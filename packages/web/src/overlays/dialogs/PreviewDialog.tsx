import { XMarkdown } from '@ant-design/x-markdown'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { DocumentItem } from '@/features/KnowledgeBase/types'

export interface PreviewResult {
  type: 'text' | 'pdf' | 'unsupported'
  mimeType: string
  content?: string
  url?: string | null
}

interface PreviewDialogProps {
  document: DocumentItem
  preview: PreviewResult
  onClose?: () => void
}

export default function PreviewDialog({ document, preview, onClose }: PreviewDialogProps) {
  return (
    <Dialog open onOpenChange={() => onClose?.()}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{document.name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto mt-4">
          {preview.type === 'text' && preview.content !== undefined && (
            <div className="prose prose-sm max-w-none">
              {document.ext === 'md' ? (
                <XMarkdown content={preview.content} escapeRawHtml />
              ) : (
                <pre className="whitespace-pre-wrap text-sm">{preview.content}</pre>
              )}
            </div>
          )}

          {preview.type === 'pdf' && preview.url && (
            <iframe
              src={preview.url}
              title={document.name}
              className="w-full h-[60vh] border rounded-md"
            />
          )}

          {preview.type === 'unsupported' && (
            <div className="text-center py-12 text-text-secondary">
              <p>该文件类型暂不支持在线预览</p>
              {preview.url && (
                <a
                  href={preview.url}
                  download={document.name}
                  className="text-primary hover:underline mt-2 inline-block"
                >
                  下载文件
                </a>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
