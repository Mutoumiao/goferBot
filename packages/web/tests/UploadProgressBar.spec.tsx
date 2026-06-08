import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UploadProgressBar } from '@/components/kb/UploadProgressBar'
import type { UploadTask } from '@/stores/file'

describe('UploadProgressBar', () => {
  it('AC-05: displays aggregate progress for multiple uploads', () => {
    const tasks: UploadTask[] = [
      { id: 't1', fileName: 'a.pdf', fileSize: 1000, progress: 50, status: 'uploading', kbId: 'kb-1' },
      { id: 't2', fileName: 'b.pdf', fileSize: 1000, progress: 100, status: 'completed', kbId: 'kb-1' },
    ]
    render(<UploadProgressBar tasks={tasks} activeUploadCount={1} onRetry={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByText('正在上传 1 个文件')).toBeDefined()
    expect(screen.getByText('a.pdf')).toBeDefined()
  })

  it('AC-05: shows 50% progress for a single task at half completion', () => {
    const tasks: UploadTask[] = [
      { id: 't1', fileName: 'half.pdf', fileSize: 2000, progress: 50, status: 'uploading', kbId: 'kb-1' },
    ]
    render(<UploadProgressBar tasks={tasks} activeUploadCount={1} onRetry={vi.fn()} onClear={vi.fn()} />)
    const bar = document.querySelector('[data-testid="progress-fill"]')
    expect(bar).toBeDefined()
  })

  it('AC-06: shows error state with retry button', () => {
    const tasks: UploadTask[] = [
      { id: 't1', fileName: 'fail.pdf', fileSize: 1000, progress: 30, status: 'failed', error: '网络错误', kbId: 'kb-1' },
    ]
    const onRetry = vi.fn()
    render(<UploadProgressBar tasks={tasks} activeUploadCount={0} onRetry={onRetry} onClear={vi.fn()} />)
    expect(screen.getByText('上传失败')).toBeDefined()
    const retryBtn = screen.getByTitle('重试上传')
    fireEvent.click(retryBtn)
    expect(onRetry).toHaveBeenCalledWith('t1')
  })

  it('AC-09: aggregates progress across multiple concurrent uploads', () => {
    const tasks: UploadTask[] = [
      { id: 't1', fileName: 'f1.pdf', fileSize: 500, progress: 80, status: 'uploading', kbId: 'kb-1' },
      { id: 't2', fileName: 'f2.pdf', fileSize: 500, progress: 40, status: 'uploading', kbId: 'kb-1' },
      { id: 't3', fileName: 'f3.pdf', fileSize: 500, progress: 100, status: 'completed', kbId: 'kb-1' },
    ]
    render(<UploadProgressBar tasks={tasks} activeUploadCount={2} onRetry={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByText('正在上传 2 个文件')).toBeDefined()
    // All three file names visible
    expect(screen.getByText('f1.pdf')).toBeDefined()
    expect(screen.getByText('f2.pdf')).toBeDefined()
    expect(screen.getByText('f3.pdf')).toBeDefined()
  })

  it('hides when no tasks', () => {
    const { container } = render(
      <UploadProgressBar tasks={[]} activeUploadCount={0} onRetry={vi.fn()} onClear={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('calls onClear for completed tasks', () => {
    const tasks: UploadTask[] = [
      { id: 't1', fileName: 'done.pdf', fileSize: 1000, progress: 100, status: 'completed', kbId: 'kb-1' },
    ]
    const onClear = vi.fn()
    render(<UploadProgressBar tasks={tasks} activeUploadCount={0} onRetry={vi.fn()} onClear={onClear} />)
    const dismissBtn = screen.getByTitle('清除已完成')
    fireEvent.click(dismissBtn)
    expect(onClear).toHaveBeenCalled()
  })
})
