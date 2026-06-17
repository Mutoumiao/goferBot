import { useState, useEffect } from 'react'
import { Folder as FolderIcon, Home, Loader2, BookOpen } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getFolders } from '@/api/file'
import { getKbForSelector } from '@/api/KnowledgeBase'
import { useKbStore } from '../store'
import { moveDocument, moveFolder, copyDocument, copyFolder } from '../services'
import type { Folder as FolderType, DocumentItem } from '../types'
import type { KbEntry } from '@goferbot/data'

interface MoveCopyDialogProps {
  mode: 'move' | 'copy'
  item: FolderType | DocumentItem
  onClose?: (result?: unknown) => void
  onConfirm?: () => void | Promise<void>
}

interface FolderOption {
  id: string
  name: string
  depth: number
  parentId: string | null
}

const ROOT_VALUE = 'root'

async function loadAllFolders(kbId: string): Promise<FolderOption[]> {
  const result: FolderOption[] = []
  await loadChildren(kbId, null, 0, result)
  return result
}

async function loadChildren(
  kbId: string,
  parentId: string | null,
  depth: number,
  result: FolderOption[],
): Promise<void> {
  let folders: FolderType[] = []
  try {
    folders = (await getFolders(kbId, parentId).send()) as FolderType[]
  } catch {
    return
  }
  for (const folder of folders) {
    result.push({ id: folder.id, name: folder.name, depth, parentId: folder.parentId ?? null })
    await loadChildren(kbId, folder.id, depth + 1, result)
  }
}

function isDescendant(folders: FolderOption[], ancestorId: string, folderId: string): boolean {
  const folderMap = new Map(folders.map((f) => [f.id, f.parentId]))
  let current = folderMap.get(folderId)
  while (current) {
    if (current === ancestorId) return true
    current = folderMap.get(current)
  }
  return false
}

function isFolder(item: FolderType | DocumentItem): item is FolderType {
  return !('status' in item)
}

export default function MoveCopyDialog({ mode, item, onClose, onConfirm }: MoveCopyDialogProps) {
  const { currentKbId } = useKbStore()
  const [kbs, setKbs] = useState<KbEntry[]>([])
  const [folders, setFolders] = useState<FolderOption[]>([])
  const [loadingKbs, setLoadingKbs] = useState(false)
  const [loadingFolders, setLoadingFolders] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [targetKbId, setTargetKbId] = useState<string>(currentKbId ?? '')
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null)

  const actionText = mode === 'move' ? '移动' : '复制'
  const itemTypeText = isFolder(item) ? '文件夹' : '文档'

  useEffect(() => {
    if (!currentKbId) return
    let cancelled = false
    setLoadingKbs(true)
    getKbForSelector()
      .send()
      .then((res) => {
        if (cancelled) return
        const data = res as { items?: KbEntry[]; data?: KbEntry[] }
        const list = ((data.items ?? data.data) ?? []) as KbEntry[]
        setKbs(list)
        if (list.some((kb) => kb.id === currentKbId)) {
          setTargetKbId(currentKbId)
        } else if (list.length > 0) {
          setTargetKbId(list[0].id)
        }
      })
      .catch(() => {
        if (cancelled) return
        toast.error('加载知识库列表失败')
        setLoadError(true)
      })
      .finally(() => {
        if (cancelled) return
        setLoadingKbs(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentKbId])

  useEffect(() => {
    if (!targetKbId) return
    let cancelled = false
    setLoadingFolders(true)
    setLoadError(false)
    loadAllFolders(targetKbId)
      .then((result) => {
        if (cancelled) return
        setFolders(result)
      })
      .catch(() => {
        if (cancelled) return
        setLoadError(true)
        toast.error('加载文件夹列表失败')
      })
      .finally(() => {
        if (cancelled) return
        setLoadingFolders(false)
      })
    return () => {
      cancelled = true
    }
  }, [targetKbId])

  const handleConfirm = async () => {
    if (!currentKbId) return
    setConfirming(true)
    try {
      const folderId = targetFolderId === ROOT_VALUE ? null : targetFolderId
      if (mode === 'move') {
        if (isFolder(item)) {
          await moveFolder(item.id, targetKbId, folderId)
        } else {
          await moveDocument(item.id, targetKbId, folderId)
        }
      } else {
        if (isFolder(item)) {
          await copyFolder(item.id, targetKbId, folderId)
        } else {
          await copyDocument(item.id, targetKbId, folderId)
        }
      }
      await onConfirm?.()
      onClose?.(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `${actionText}失败`)
    } finally {
      setConfirming(false)
    }
  }

  const selectedValue = targetFolderId ?? ROOT_VALUE
  const canConfirm = !!currentKbId && !confirming && !loadingFolders && !loadingKbs

  // folder 操作时（move/copy），禁止选择自身及后代（避免移动到自身或复制到自身子树形成循环）
  const disabledFolderIds = isFolder(item)
    ? new Set(folders.filter((f) => f.id === item.id || isDescendant(folders, item.id, f.id)).map((f) => f.id))
    : new Set<string>()
  const visibleFolders = folders

  return (
    <Dialog open onOpenChange={() => onClose?.(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{actionText}{itemTypeText}</DialogTitle>
          <DialogDescription>
            将「<span className="font-medium text-foreground">{item.name}</span>」{actionText}到：
          </DialogDescription>
        </DialogHeader>

        {!currentKbId && (
          <p className="text-sm text-destructive py-4">当前未选择知识库，无法{actionText}{itemTypeText}。</p>
        )}

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">目标知识库</label>
            <Select value={targetKbId} onValueChange={setTargetKbId} disabled={loadingKbs}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择知识库" />
              </SelectTrigger>
              <SelectContent>
                {kbs.map((kb) => (
                  <SelectItem key={kb.id} value={kb.id}>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <span>{kb.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">目标文件夹</label>
            {loadingFolders ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <RadioGroup
                value={selectedValue}
                onValueChange={(value) => setTargetFolderId(value === ROOT_VALUE ? null : value)}
                className="max-h-[240px] overflow-y-auto rounded-md border p-2"
                aria-label="选择目标文件夹"
              >
                <div className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
                  <RadioGroupItem value={ROOT_VALUE} id={ROOT_VALUE} />
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <label htmlFor={ROOT_VALUE} className="flex-1 cursor-pointer text-sm">根目录</label>
                </div>
                {visibleFolders.map((folder) => {
                  const disabled = disabledFolderIds.has(folder.id)
                  return (
                    <div
                      key={folder.id}
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent"
                      style={{ paddingLeft: `${12 + folder.depth * 16}px` }}
                    >
                      <RadioGroupItem value={folder.id} id={folder.id} disabled={disabled} />
                      <FolderIcon className="h-4 w-4 text-muted-foreground" />
                      <label
                        htmlFor={folder.id}
                        className={`flex-1 cursor-pointer text-sm ${disabled ? 'text-muted-foreground' : ''}`}
                      >
                        {folder.name}
                      </label>
                    </div>
                  )
                })}
              </RadioGroup>
            )}
          </div>
        </div>

        {loadError && (
          <p className="text-xs text-destructive py-2">部分数据加载失败，列表可能不完整。</p>
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
