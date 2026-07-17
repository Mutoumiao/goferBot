import { beforeEach, describe, expect, it, vi } from 'vitest'

const openDialog = vi.fn()

vi.mock('@/overlays/services/overlay-service', () => ({
  openDialog: (...args: unknown[]) => openDialog(...args),
}))

describe('openCompanion*Dialog', () => {
  beforeEach(() => {
    openDialog.mockReset()
    openDialog.mockResolvedValue(true)
  })

  it('openCompanionCreateDialog opens form dialog in create mode', async () => {
    const { openCompanionCreateDialog } = await import(
      '@/features/companion/dialogs/open-companion-dialogs'
    )
    const onSuccess = vi.fn()
    await openCompanionCreateDialog({ onSuccess })
    expect(openDialog).toHaveBeenCalledTimes(1)
    const [, props] = openDialog.mock.calls[0] as [unknown, { mode: string; onSuccess?: unknown }]
    expect(props.mode).toBe('create')
    expect(props.onSuccess).toBe(onSuccess)
  })

  it('openCompanionEditDialog passes companionId', async () => {
    const { openCompanionEditDialog } = await import(
      '@/features/companion/dialogs/open-companion-dialogs'
    )
    await openCompanionEditDialog({ companionId: 'c1' })
    const [, props] = openDialog.mock.calls[0] as [
      unknown,
      { mode: string; companionId: string },
    ]
    expect(props.mode).toBe('edit')
    expect(props.companionId).toBe('c1')
  })

  it('openCompanionCareDialog and memories pass companionId', async () => {
    const {
      openCompanionCareDialog,
      openCompanionMemoriesDialog,
    } = await import('@/features/companion/dialogs/open-companion-dialogs')
    await openCompanionCareDialog({ companionId: 'c2' })
    await openCompanionMemoriesDialog({ companionId: 'c3' })
    expect(openDialog).toHaveBeenCalledTimes(2)
    expect((openDialog.mock.calls[0][1] as { companionId: string }).companionId).toBe('c2')
    expect((openDialog.mock.calls[1][1] as { companionId: string }).companionId).toBe('c3')
  })
})
