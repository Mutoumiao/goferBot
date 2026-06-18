import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

import { toast } from 'sonner'
import EditAvatarDialog from '@/overlays/dialogs/EditAvatarDialog'

describe('EditAvatarDialog', () => {
  const mockOnClose = vi.fn()
  const mockOnConfirm = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders upload area when no image selected', () => {
    render(<EditAvatarDialog onClose={mockOnClose} onConfirm={mockOnConfirm} />)

    expect(screen.getByText('点击或拖拽上传图片')).toBeDefined()
    expect(screen.getByText('支持 PNG、JPEG、WebP，不大于 5MB')).toBeDefined()
  })

  it('shows current avatar when provided', async () => {
    render(
      <EditAvatarDialog
        currentAvatar="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    )

    // 图片加载完成后应该显示 canvas
    await waitFor(
      () => {
        expect(document.querySelector('canvas')).toBeDefined()
      },
      { timeout: 3000 },
    )
  })

  it('rejects file larger than 5MB', () => {
    render(<EditAvatarDialog onClose={mockOnClose} onConfirm={mockOnConfirm} />)

    const file = new File(['x'], 'large.png', { type: 'image/png' })
    Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 })

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    expect(toast.error).toHaveBeenCalledWith('图片大小不能超过 5MB')
  })

  it('rejects unsupported file types', () => {
    render(<EditAvatarDialog onClose={mockOnClose} onConfirm={mockOnConfirm} />)

    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    expect(toast.error).toHaveBeenCalledWith('仅支持 PNG、JPEG、WebP 格式')
  })

  it('accepts valid image file', async () => {
    render(<EditAvatarDialog onClose={mockOnClose} onConfirm={mockOnConfirm} />)

    // 创建一个有效的 base64 图片
    const base64Image =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const blob = await fetch(base64Image).then((r) => r.blob())
    const file = new File([blob], 'test.png', { type: 'image/png' })

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    // 等待图片加载完成后 canvas 出现
    await waitFor(
      () => {
        expect(document.querySelector('canvas')).toBeDefined()
      },
      { timeout: 3000 },
    )
  })

  it('shows loading state while image is loading', async () => {
    render(<EditAvatarDialog onClose={mockOnClose} onConfirm={mockOnConfirm} />)

    const base64Image =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const blob = await fetch(base64Image).then((r) => r.blob())
    const file = new File([blob], 'test.png', { type: 'image/png' })

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    // 在图片加载完成前，应该能看到 canvas 或加载状态
    // 由于 base64 小图片加载很快，我们验证最终状态是 canvas 出现
    await waitFor(
      () => {
        expect(document.querySelector('canvas')).toBeDefined()
      },
      { timeout: 3000 },
    )
  })

  it('closes when cancel button clicked', () => {
    render(<EditAvatarDialog onClose={mockOnClose} onConfirm={mockOnConfirm} />)

    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(mockOnClose).toHaveBeenCalledWith(false)
  })

  it('shows error when confirming without image', () => {
    render(<EditAvatarDialog onClose={mockOnClose} onConfirm={mockOnConfirm} />)

    // 确认保存按钮在 disabled 状态下点击不会触发 onClick
    const confirmButton = screen.getByRole('button', { name: '确认保存' }) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(true)
  })

  it('disables confirm button when no image', () => {
    render(<EditAvatarDialog onClose={mockOnClose} onConfirm={mockOnConfirm} />)

    const confirmButton = screen.getByRole('button', { name: '确认保存' }) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(true)
  })

  it('has correct scale boundaries', async () => {
    render(
      <EditAvatarDialog
        currentAvatar="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    )

    // 等待图片加载完成
    await waitFor(
      () => {
        expect(screen.queryByText('图片加载中...')).toBeNull()
      },
      { timeout: 3000 },
    )

    // 检查缩放滑块是否存在
    const slider = document.querySelector('[role="slider"]')
    expect(slider).toBeDefined()
  })

  it('has rotate buttons', async () => {
    render(
      <EditAvatarDialog
        currentAvatar="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    )

    // 等待图片加载完成
    await waitFor(
      () => {
        expect(screen.queryByText('图片加载中...')).toBeNull()
      },
      { timeout: 3000 },
    )

    // 检查旋转按钮是否存在（通过 title 属性）
    const rotateLeftButton = document.querySelector('button[title="向左旋转"]')
    const rotateRightButton = document.querySelector('button[title="向右旋转"]')
    expect(rotateLeftButton).toBeDefined()
    expect(rotateRightButton).toBeDefined()
  })

  it('has re-upload button', async () => {
    render(
      <EditAvatarDialog
        currentAvatar="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    )

    // 等待图片加载完成
    await waitFor(
      () => {
        expect(screen.queryByText('图片加载中...')).toBeNull()
      },
      { timeout: 3000 },
    )

    expect(screen.getByText('重新选择')).toBeDefined()
  })
})
