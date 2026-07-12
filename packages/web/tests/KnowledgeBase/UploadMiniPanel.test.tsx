import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UploadMiniPanel } from '@/features/KnowledgeBase/components/UploadMiniPanel'
import { useKbStore } from '@/features/KnowledgeBase/store'
import type { UploadTask } from '@/features/KnowledgeBase/types'

function task(partial: Partial<UploadTask> & Pick<UploadTask, 'id' | 'status'>): UploadTask {
  return {
    fileName: `${partial.id}.pdf`,
    fileSize: 100,
    kbId: 'kb1',
    folderId: null,
    progress: partial.status === 'completed' ? 100 : 40,
    ...partial,
  }
}

describe('UploadMiniPanel', () => {
  beforeEach(() => {
    useKbStore.setState({
      uploadTasks: [],
      uploadManagerOpen: false,
      uploadMiniDismissed: false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('hides when no relevant tasks', () => {
    render(<UploadMiniPanel />)
    expect(screen.queryByTestId('upload-mini-panel')).toBeNull()
  })

  it('shows when uploading', () => {
    useKbStore.setState({
      uploadTasks: [task({ id: 't1', status: 'uploading', progress: 30 })],
    })
    render(<UploadMiniPanel />)
    expect(screen.getByTestId('upload-mini-panel')).toBeDefined()
    expect(screen.getByText(/正在上传/)).toBeDefined()
  })

  it('hides when manager dialog is open', () => {
    useKbStore.setState({
      uploadTasks: [task({ id: 't1', status: 'uploading' })],
      uploadManagerOpen: true,
    })
    render(<UploadMiniPanel />)
    expect(screen.queryByTestId('upload-mini-panel')).toBeNull()
  })

  it('hides when dismissed', () => {
    useKbStore.setState({
      uploadTasks: [task({ id: 't1', status: 'uploading' })],
      uploadMiniDismissed: true,
    })
    render(<UploadMiniPanel />)
    expect(screen.queryByTestId('upload-mini-panel')).toBeNull()
  })

  it('shows failed state', () => {
    useKbStore.setState({
      uploadTasks: [task({ id: 't1', status: 'failed', error: 'x', progress: 0 })],
    })
    render(<UploadMiniPanel />)
    expect(screen.getByText(/上传失败/)).toBeDefined()
  })

  it('clears completed after success delay', () => {
    vi.useFakeTimers()
    useKbStore.setState({
      uploadTasks: [task({ id: 't1', status: 'completed', progress: 100 })],
    })
    render(<UploadMiniPanel />)
    expect(screen.getByText('上传完成')).toBeDefined()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(useKbStore.getState().uploadTasks).toHaveLength(0)
  })
})
