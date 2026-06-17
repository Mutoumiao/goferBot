import { useState, useEffect } from 'react'
import { Folder, Home, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { getFolders } from '@/api/file'
import { useKbStore } from '../store'
import { moveDocument } from '../services'
import type { Folder as FolderType } from '../types'

interface MoveDocumentDialogProps {
  docId: string
  docName: string
  onClose?: (result?: unknown) => void
  onConfirm?: () => void | Promise<void>
}

interface FolderOption {
  id: string
  name: string
  depth: number
}

const ROOT_VALUE = 'root'

interface LoadResult {
  folders: FolderOption[]
  hasError: boolean
}

async function loadAllFolders(kbId: string): Promise<LoadResult> {
  const result: FolderOption[] = []
  const hasError = await loadChildren(kbId, null, 0, result)
  return { folders: result, hasError }
}

async function loadChildren(
  kbId: string,
  parentId: string | null,
  depth: number,
  result: FolderOption[],
): Promise<boolean> {
  let folders: FolderType[] = []
  let hasError = false
  try {
    folders = (await getFolders(kbId, parentId).send()) as FolderType[]
  } catch {
    hasError = true
  }
  for (const folder of folders) {
    result.push({ id: folder.id, name: folder.name, depth })
    const childError = await loadChildren(kbId, folder.id, depth + 1, result)
    if (childError) hasError = true
  }
  return hasError
}

export default function MoveDocumentDialog({ docId, docName, onClose, onConfirm }: MoveDocumentDialogProps) {
  const { currentKbId, currentFolderId } = useKbStore()
  const [folders, setFolders] = useState<FolderOption[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null)

  useEffect(() => {
    if (!currentKbId) return
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    loadAllFolders(currentKbId)
      .then(({ folders, hasError }) => {
        if (cancelled) return
        setFolders(folders)
        setLoadError(hasError)
      })
      .catch(() => {
        if (cancelled) return
        setLoadError(true)
        toast.error('加载文件夹列表失败')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentKbId, docId])

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      await moveDocument(docId, targetFolderId)
      await onConfirm?.()
      onClose?.(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '移动失败')
    } finally {
      setConfirming(false)
    }
  }

  const selectedValue = targetFolderId ?? ROOT_VALUE
  const canConfirm = !!currentKbId && !confirming && !loading

  return (
    <Dialog open onOpenChange={() => onClose?.(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>移动文件</DialogTitle>
          <DialogDescription>
            将「<span className="font-medium text-foreground">{docName}</span>」移动到：
          </DialogDescription>
        </DialogHeader>

        {!currentKbId && (
          <p className="text-sm text-destructive py-4">当前未选择知识库，无法移动文件。</p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <RadioGroup
            value={selectedValue}
            onValueChange={(value) => setTargetFolderId(value === ROOT_VALUE ? null : value)}
            className="max-h-[320px] overflow-y-auto py-2"
            aria-label="选择目标文件夹"
          >
            <div className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
              <RadioGroupItem value={ROOT_VALUE} id={ROOT_VALUE} />
              <Home className="h-4 w-4 text-muted-foreground" />
              <label htmlFor={ROOT_VALUE} className="flex-1 cursor-pointer text-sm">根目录</label>
            </div>
            {folders
              .filter((folder) => folder.id !== currentFolderId)
              .map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent"
                  style={{ paddingLeft: `${12 + folder.depth * 16}px` }}
                >
                  <RadioGroupItem value={folder.id} id={folder.id} />
                  <Folder className="h-4 w-4 text-muted-foreground" />
                  <label htmlFor={folder.id} className="flex-1 cursor-pointer text-sm">
                    {folder.name}
                  </label>
                </div>
              ))}
          </RadioGroup>
        )}

        {loadError && (
          <p className="text-xs text-destructive py-2">部分文件夹加载失败，列表可能不完整。</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose?.(false)} disabled={confirming}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {confirming && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            确定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
