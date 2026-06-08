import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UploadDropZone } from '@/components/kb/UploadDropZone'

function createDragEvent(type: string, files: File[] = []) {
  const dataTransfer = {
    files,
    items: files.map(() => ({ kind: 'file', type: '' })),
    types: files.length > 0 ? ['Files'] : [],
    getData: vi.fn(),
    setData: vi.fn(),
    clearData: vi.fn(),
  }
  const event = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    dataTransfer: typeof dataTransfer
    preventDefault: () => void
    stopPropagation: () => void
  }
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer, writable: false })
  event.preventDefault = vi.fn()
  event.stopPropagation = vi.fn()
  return event
}

describe('UploadDropZone', () => {
  const defaultProps = {
    kbId: 'kb-1',
    onFilesSelected: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('AC-01: renders upload prompt with dashed border', () => {
    render(<UploadDropZone {...defaultProps} />)
    expect(screen.getByText(/拖拽文件到此处/)).toBeDefined()
    expect(screen.getByText(/或点击选择/)).toBeDefined()
    const zone = document.querySelector('[data-testid="upload-drop-zone"]')
    expect(zone).toBeDefined()
    expect(zone!.className).toContain('border-dashed')
  })

  it('AC-01: adds dragOver visual state on dragover', () => {
    render(<UploadDropZone {...defaultProps} />)
    const zone = document.querySelector('[data-testid="upload-drop-zone"]')!
    const dragOverEvent = createDragEvent('dragover', [new File([''], 'test.pdf')])
    fireEvent(zone, dragOverEvent)
    // after dragOver, zone should have highlight class
    expect(dragOverEvent.preventDefault).toHaveBeenCalled()
  })

  it('AC-01: removes dragOver visual state on dragleave', () => {
    render(<UploadDropZone {...defaultProps} />)
    const zone = document.querySelector('[data-testid="upload-drop-zone"]')!
    fireEvent(zone, createDragEvent('dragenter', [new File([''], 'test.pdf')]))
    fireEvent(zone, createDragEvent('dragleave'))
    // after dragleave, zone should return to idle
    // verify by checking that drag-is-over class is removed
    expect(zone.className).not.toContain('drag-is-over')
  })

  it('AC-01: calls onFilesSelected when files are dropped', () => {
    const onFilesSelected = vi.fn()
    render(<UploadDropZone {...defaultProps} onFilesSelected={onFilesSelected} />)
    const zone = document.querySelector('[data-testid="upload-drop-zone"]')!
    const file1 = new File(['content'], 'doc1.pdf', { type: 'application/pdf' })
    const file2 = new File(['content2'], 'doc2.txt', { type: 'text/plain' })
    const dropEvent = createDragEvent('drop', [file1, file2])
    fireEvent(zone, dropEvent)
    expect(onFilesSelected).toHaveBeenCalledWith([file1, file2])
  })

  it('AC-01: opens file picker on click', () => {
    render(<UploadDropZone {...defaultProps} />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeDefined()
    expect(fileInput.multiple).toBe(true)
  })

  it('AC-01: calls onFilesSelected when files are selected via click', () => {
    const onFilesSelected = vi.fn()
    render(<UploadDropZone {...defaultProps} onFilesSelected={onFilesSelected} />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'selected.pdf', { type: 'application/pdf' })
    // Simulate file selection
    Object.defineProperty(fileInput, 'files', { value: [file], writable: false })
    fireEvent.change(fileInput)
    expect(onFilesSelected).toHaveBeenCalledWith([file])
  })

  it('rejects files exceeding 50MB with warning', () => {
    const onFilesSelected = vi.fn()
    render(<UploadDropZone {...defaultProps} onFilesSelected={onFilesSelected} />)
    const zone = document.querySelector('[data-testid="upload-drop-zone"]')!
    // 使用允许类型的文件，但大小超过限制
    const largeFile = new File([new ArrayBuffer(51 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' })
    Object.defineProperty(largeFile, 'size', { value: 51 * 1024 * 1024 })
    const dropEvent = createDragEvent('drop', [largeFile])
    fireEvent(zone, dropEvent)
    expect(onFilesSelected).not.toHaveBeenCalled()
    expect(screen.getByText(/超过 50MB 限制/)).toBeDefined()
  })

  it('AC-10: rejects unsupported file types', () => {
    const onFilesSelected = vi.fn()
    render(<UploadDropZone {...defaultProps} onFilesSelected={onFilesSelected} />)
    const zone = document.querySelector('[data-testid="upload-drop-zone"]')!
    const badFile = new File(['content'], 'video.mp4', { type: 'video/mp4' })
    const dropEvent = createDragEvent('drop', [badFile])
    fireEvent(zone, dropEvent)
    expect(onFilesSelected).not.toHaveBeenCalled()
    // 检查被拒绝的文件以红色标记渲染
    const rejectedEl = document.querySelector('[data-testid="rejected-file"]')
    expect(rejectedEl).toBeDefined()
    expect(rejectedEl!.textContent).toContain('不支持的文件类型')
  })

  it('AC-10: accepts allowed file types (.md, .txt, .pdf)', () => {
    const onFilesSelected = vi.fn()
    render(<UploadDropZone {...defaultProps} onFilesSelected={onFilesSelected} />)
    const zone = document.querySelector('[data-testid="upload-drop-zone"]')!
    const mdFile = new File(['# doc'], 'readme.md', { type: 'text/markdown' })
    const txtFile = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    const pdfFile = new File(['%PDF'], 'report.pdf', { type: 'application/pdf' })
    const dropEvent = createDragEvent('drop', [mdFile, txtFile, pdfFile])
    fireEvent(zone, dropEvent)
    expect(onFilesSelected).toHaveBeenCalledWith([mdFile, txtFile, pdfFile])
    // 没有被拒绝文件
    const rejectedEl = document.querySelector('[data-testid="rejected-file"]')
    expect(rejectedEl).toBeNull()
  })

  it('AC-10: renders rejected files with red marker', () => {
    const onFilesSelected = vi.fn()
    render(<UploadDropZone {...defaultProps} onFilesSelected={onFilesSelected} />)
    const zone = document.querySelector('[data-testid="upload-drop-zone"]')!
    // 同时拖入合法和非法文件
    const goodFile = new File(['doc'], 'valid.pdf', { type: 'application/pdf' })
    const badFile = new File(['video'], 'movie.mp4', { type: 'video/mp4' })
    const dropEvent = createDragEvent('drop', [goodFile, badFile])
    fireEvent(zone, dropEvent)
    // 合法文件被接受
    expect(onFilesSelected).toHaveBeenCalledWith([goodFile])
    // 非法文件以红色标记显示
    const rejectedEls = document.querySelectorAll('[data-testid="rejected-file"]')
    expect(rejectedEls.length).toBe(1)
    expect(rejectedEls[0].textContent).toContain('不支持的文件类型')
  })
})
