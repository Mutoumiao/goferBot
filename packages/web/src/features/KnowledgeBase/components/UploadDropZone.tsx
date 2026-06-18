import { Cloud } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB，与后端限制对齐

const ALLOWED_EXTENSIONS = ['.md', '.txt', '.html', '.csv', '.json', '.pdf']

const ILLEGAL_FILENAME_PATTERN = /[\x00-\x1f\x7f]|\.\.|\/|\\/

interface UploadDropZoneProps {
  kbId: string
  onFilesSelected: (files: File[]) => void
}

export function UploadDropZone({ onFilesSelected }: UploadDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [rejectedFiles, setRejectedFiles] = useState<{ name: string; reason: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList)
      const valid: File[] = []
      const skipped: string[] = []
      const rejected: { name: string; reason: string }[] = []

      for (const file of files) {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase()
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          rejected.push({ name: file.name, reason: '不支持的文件类型' })
          continue
        }
        if (file.size > MAX_FILE_SIZE) {
          skipped.push(`${file.name} 超过 50MB 限制`)
          continue
        }
        if (ILLEGAL_FILENAME_PATTERN.test(file.name)) {
          rejected.push({ name: file.name, reason: '文件名包含非法字符' })
          continue
        }
        valid.push(file)
      }

      if (rejected.length > 0) {
        setRejectedFiles((prev) => [...prev, ...rejected])
      }

      if (skipped.length > 0) {
        setWarning(skipped.join('；'))
      } else {
        setWarning(null)
      }

      if (valid.length > 0) {
        onFilesSelected(valid)
      }
    },
    [onFilesSelected],
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files)
      e.target.value = ''
    }
  }

  return (
    <div>
      <div
        data-testid="upload-drop-zone"
        role="button"
        tabIndex={0}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
          ${
            isDragOver
              ? 'border-blue-400 bg-blue-50 scale-[1.02]'
              : 'border-border-default bg-surface-1 hover:border-text-tertiary'
          }`}
        onDragOver={handleDragOver}
        onDragEnter={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleClick()
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".md,.txt,.html,.csv,.json,.pdf"
          className="hidden"
          onChange={handleFileChange}
          tabIndex={-1}
          aria-hidden="true"
        />
        <Cloud
          className={`mx-auto h-12 w-12 mb-3 transition-transform ${isDragOver ? 'text-blue-500 scale-110' : 'text-text-tertiary'}`}
        />
        <p className="text-sm text-text-secondary">拖拽文件到此处，或点击选择</p>
        <p className="mt-1 text-xs text-text-tertiary">支持多文件，单文件最大 50MB</p>
      </div>

      {warning && (
        <div className="mt-2 rounded bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-700">
          {warning}
        </div>
      )}

      {rejectedFiles.length > 0 && (
        <div className="mt-2 space-y-1">
          {rejectedFiles.map((item, idx) => (
            <div
              key={idx}
              data-testid="rejected-file"
              className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600"
            >
              <span className="flex-1 truncate">{item.name}</span>
              <span className="shrink-0 font-medium">不支持的文件类型</span>
            </div>
          ))}
          <Button variant="link" size="sm" onClick={() => setRejectedFiles([])}>
            清除
          </Button>
        </div>
      )}
    </div>
  )
}
