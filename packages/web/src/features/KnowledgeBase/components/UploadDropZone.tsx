import { Cloud } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { partitionUploadFiles, UPLOAD_ACCEPT } from '../upload-validation'

interface UploadDropZoneProps {
  onFilesSelected: (files: File[]) => void
  /** 无 kb 时禁用选文件 */
  disabled?: boolean
}

export function UploadDropZone({ onFilesSelected, disabled = false }: UploadDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [rejectedFiles, setRejectedFiles] = useState<{ name: string; reason: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFiles = useCallback(
    (fileList: FileList | File[]) => {
      if (disabled) return
      const { valid, rejected } = partitionUploadFiles(Array.from(fileList))

      const sizeWarnings = rejected
        .filter((r) => r.code === 'oversize')
        .map((r) => `${r.name} ${r.reason}`)
      const otherRejected = rejected.filter((r) => r.code !== 'oversize')

      if (otherRejected.length > 0) {
        setRejectedFiles((prev) => [...prev, ...otherRejected])
      }

      if (sizeWarnings.length > 0) {
        setWarning(sizeWarnings.join('；'))
      } else {
        setWarning(null)
      }

      if (valid.length > 0) {
        onFilesSelected(valid)
      }
    },
    [disabled, onFilesSelected],
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
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
    if (disabled) return
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }

  const handleClick = () => {
    if (disabled) return
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
      <button
        type="button"
        data-testid="upload-drop-zone"
        disabled={disabled}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all w-full
          ${
            disabled
              ? 'cursor-not-allowed border-border-default bg-surface-2 opacity-60'
              : isDragOver
                ? 'cursor-pointer border-blue-400 bg-blue-50 scale-[1.02]'
                : 'cursor-pointer border-border-default bg-surface-1 hover:border-text-tertiary'
          }`}
        onDragOver={handleDragOver}
        onDragEnter={(e) => {
          e.preventDefault()
          if (!disabled) setIsDragOver(true)
        }}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={UPLOAD_ACCEPT}
          className="hidden"
          onChange={handleFileChange}
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
        />
        <Cloud
          className={`mx-auto h-12 w-12 mb-3 transition-transform ${
            disabled
              ? 'text-text-tertiary'
              : isDragOver
                ? 'text-blue-500 scale-110'
                : 'text-text-tertiary'
          }`}
        />
        <p className="text-sm text-text-secondary">
          {disabled ? '请先选择知识库后再上传' : '拖拽文件到此处，或点击选择'}
        </p>
        <p className="mt-1 text-xs text-text-tertiary">支持多文件，单文件最大 50MB</p>
      </button>

      {warning && (
        <div className="mt-2 rounded bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-700">
          {warning}
        </div>
      )}

      {rejectedFiles.length > 0 && (
        <div className="mt-2 space-y-1">
          {rejectedFiles.map((item) => (
            <div
              key={`${item.name}-${item.reason}`}
              data-testid="rejected-file"
              className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600"
            >
              <span className="flex-1 truncate">{item.name}</span>
              <span className="shrink-0 font-medium">{item.reason}</span>
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
