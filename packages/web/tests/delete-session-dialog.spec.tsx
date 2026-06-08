import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DeleteSessionDialog } from '@/overlays/dialogs/DeleteSessionDialog'

describe('DeleteSessionDialog', () => {
  it('AC-04: renders dialog with session title', () => {
    render(
      <DeleteSessionDialog
        sessionTitle="My Session"
        onClose={() => {}}
      />,
    )

    expect(screen.getByText('删除会话')).toBeDefined()
    expect(
      screen.getByText(/确定删除「My Session」？此操作不可撤销/),
    ).toBeDefined()
    expect(screen.getByTestId('delete-cancel-btn')).toBeDefined()
    expect(screen.getByTestId('delete-confirm-btn')).toBeDefined()
  })

  it('AC-04: calls onClose with "confirm" when confirm button clicked', () => {
    const onClose = vi.fn()
    render(
      <DeleteSessionDialog
        sessionTitle="Test"
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByTestId('delete-confirm-btn'))
    expect(onClose).toHaveBeenCalledWith('confirm')
  })

  it('AC-04: calls onClose with "cancel" when cancel button clicked', () => {
    const onClose = vi.fn()
    render(
      <DeleteSessionDialog
        sessionTitle="Test"
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByTestId('delete-cancel-btn'))
    expect(onClose).toHaveBeenCalledWith('cancel')
  })

  it('AC-04: disables buttons when loading', () => {
    render(
      <DeleteSessionDialog
        sessionTitle="Test"
        onClose={() => {}}
        loading={true}
      />,
    )

    expect((screen.getByTestId('delete-confirm-btn') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('delete-cancel-btn') as HTMLButtonElement).disabled).toBe(true)
  })
})
