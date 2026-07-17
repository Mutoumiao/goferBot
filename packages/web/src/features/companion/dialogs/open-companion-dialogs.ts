/**
 * Companion 二级命令式入口（path 保持 /companions）。
 */
import { openDialog } from '@/overlays/services/overlay-service'
import type { Companion } from '../types'
import type { CompanionCareDialogProps } from './CompanionCareDialog'
import type { CompanionFormDialogProps } from './CompanionFormDialog'
import type { CompanionMemoriesDialogProps } from './CompanionMemoriesDialog'

export async function openCompanionCreateDialog(options?: {
  onSuccess?: (companion: Companion) => void | Promise<void>
}): Promise<boolean> {
  const CompanionFormDialog = (await import('./CompanionFormDialog')).default
  const result = await openDialog<boolean, CompanionFormDialogProps>(CompanionFormDialog, {
    mode: 'create',
    onSuccess: options?.onSuccess,
  })
  return result === true
}

export async function openCompanionEditDialog(options: {
  companionId: string
  onSuccess?: (companion: Companion) => void | Promise<void>
}): Promise<boolean> {
  const CompanionFormDialog = (await import('./CompanionFormDialog')).default
  const result = await openDialog<boolean, CompanionFormDialogProps>(CompanionFormDialog, {
    mode: 'edit',
    companionId: options.companionId,
    onSuccess: options.onSuccess,
  })
  return result === true
}

export async function openCompanionCareDialog(options: {
  companionId: string
  onSuccess?: () => void | Promise<void>
}): Promise<boolean> {
  const CompanionCareDialog = (await import('./CompanionCareDialog')).default
  const result = await openDialog<boolean, CompanionCareDialogProps>(CompanionCareDialog, {
    companionId: options.companionId,
    onSuccess: options.onSuccess,
  })
  return result === true
}

export async function openCompanionMemoriesDialog(options: {
  companionId: string
  onSuccess?: () => void | Promise<void>
}): Promise<void> {
  const CompanionMemoriesDialog = (await import('./CompanionMemoriesDialog')).default
  await openDialog<unknown, CompanionMemoriesDialogProps>(CompanionMemoriesDialog, {
    companionId: options.companionId,
    onSuccess: options.onSuccess,
  })
}
