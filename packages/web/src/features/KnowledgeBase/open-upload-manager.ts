import { openDialog } from '@/overlays/services/overlay-service'
import { useKbStore } from './store'
import type { ItemSortParams } from './types'

/**
 * 打开上传管理弹窗（工具栏 / 空态 / 迷你浮层统一入口）。
 * 关闭不中止上传；弹窗开时迷你浮层不显示。
 */
export async function openUploadManager(options?: { sort?: ItemSortParams }): Promise<void> {
  const state = useKbStore.getState()
  if (state.uploadManagerOpen) return

  const {
    currentKbId,
    currentFolderId,
    fileListSort,
    setUploadManagerOpen,
    setUploadMiniDismissed,
  } = state

  if (options?.sort) {
    state.setFileListSort(options.sort)
  }

  setUploadManagerOpen(true)
  setUploadMiniDismissed(false)

  try {
    const UploadManagerDialog = (await import('./components/UploadManagerDialog')).default
    await openDialog(UploadManagerDialog, {
      kbId: currentKbId,
      folderId: currentFolderId,
      sort: options?.sort ?? fileListSort ?? undefined,
    })
  } finally {
    useKbStore.getState().setUploadManagerOpen(false)
  }
}
