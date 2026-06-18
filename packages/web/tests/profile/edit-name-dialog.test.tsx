import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

import EditNameDialog from '@/overlays/dialogs/EditNameDialog'

/** 从元素获取最近的 form 元素，若不存在则抛出错误 */
function getForm(element: HTMLElement): HTMLFormElement {
  const form = element.closest('form')
  if (!form) throw new Error('Element is not inside a form')
  return form
}

describe('EditNameDialog', () => {
  const mockOnClose = vi.fn()
  const mockOnConfirm = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with current name pre-filled', () => {
    render(
      <EditNameDialog currentName="TestUser" onClose={mockOnClose} onConfirm={mockOnConfirm} />,
    )

    const input = screen.getByDisplayValue('TestUser') as HTMLInputElement
    expect(input).toBeDefined()
    expect(input.value).toBe('TestUser')
  })

  it('shows error for empty name', async () => {
    render(
      <EditNameDialog currentName="TestUser" onClose={mockOnClose} onConfirm={mockOnConfirm} />,
    )

    const input = screen.getByDisplayValue('TestUser') as HTMLInputElement
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.submit(getForm(input))

    await waitFor(() => {
      expect(screen.getByText('昵称不能为空')).toBeDefined()
    })
    expect(mockOnConfirm).not.toHaveBeenCalled()
  })

  it('shows error for name exceeding 50 characters', async () => {
    render(
      <EditNameDialog currentName="TestUser" onClose={mockOnClose} onConfirm={mockOnConfirm} />,
    )

    const input = screen.getByDisplayValue('TestUser') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'a'.repeat(51) } })
    fireEvent.submit(getForm(input))

    await waitFor(() => {
      expect(screen.getByText('昵称不能超过 50 个字符')).toBeDefined()
    })
    expect(mockOnConfirm).not.toHaveBeenCalled()
  })

  it('closes without calling onConfirm when name unchanged', async () => {
    render(
      <EditNameDialog currentName="TestUser" onClose={mockOnClose} onConfirm={mockOnConfirm} />,
    )

    const input = screen.getByDisplayValue('TestUser') as HTMLInputElement
    fireEvent.submit(getForm(input))

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled()
    })
    expect(mockOnConfirm).not.toHaveBeenCalled()
  })

  it('calls onConfirm with trimmed name when valid', async () => {
    mockOnConfirm.mockResolvedValue(undefined)

    render(
      <EditNameDialog currentName="TestUser" onClose={mockOnClose} onConfirm={mockOnConfirm} />,
    )

    const input = screen.getByDisplayValue('TestUser') as HTMLInputElement
    fireEvent.change(input, { target: { value: '  NewName  ' } })
    fireEvent.submit(getForm(input))

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith('NewName')
    })
    expect(mockOnClose).toHaveBeenCalledWith('NewName')
  })

  it('shows error when onConfirm throws', async () => {
    mockOnConfirm.mockRejectedValue(new Error('update failed'))

    render(
      <EditNameDialog currentName="TestUser" onClose={mockOnClose} onConfirm={mockOnConfirm} />,
    )

    const input = screen.getByDisplayValue('TestUser') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'NewName' } })
    fireEvent.submit(getForm(input))

    await waitFor(() => {
      expect(screen.getByText('update failed')).toBeDefined()
    })
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('closes when cancel button clicked', () => {
    render(
      <EditNameDialog currentName="TestUser" onClose={mockOnClose} onConfirm={mockOnConfirm} />,
    )

    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('disables buttons while submitting', async () => {
    mockOnConfirm.mockImplementation(() => new Promise(() => {}))

    render(
      <EditNameDialog currentName="TestUser" onClose={mockOnClose} onConfirm={mockOnConfirm} />,
    )

    const input = screen.getByDisplayValue('TestUser') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'NewName' } })
    fireEvent.submit(getForm(input))

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: '保存中...' }) as HTMLButtonElement
      expect(saveButton).toBeDefined()
      expect(saveButton.disabled).toBe(true)
    })

    const cancelButton = screen.getByRole('button', { name: '取消' }) as HTMLButtonElement
    expect(cancelButton.disabled).toBe(true)
  })
})
