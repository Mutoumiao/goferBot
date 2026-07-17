import type { ChatSourceItem } from '@goferbot/data'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  SourceCitations,
  SourceDocsFloatingPanel,
  uniqueSourceDocuments,
} from '@/features/chat/components/SourceCitations'

function makeSource(partial: Partial<ChatSourceItem> & { document_id: string }): ChatSourceItem {
  return {
    kb_id: '11111111-1111-1111-1111-111111111111',
    content: '这是段落正文不应该默认展示',
    score: 0.9,
    ...partial,
  }
}

describe('uniqueSourceDocuments', () => {
  it('dedupes by document_id and counts chunks', () => {
    const rows = uniqueSourceDocuments([
      makeSource({ document_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }),
      makeSource({ document_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }),
      makeSource({ document_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }),
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0].chunkCount).toBe(2)
    expect(rows[1].chunkCount).toBe(1)
  })
})

describe('SourceCitations', () => {
  it('renders compact trigger without paragraph content', () => {
    render(
      <SourceCitations
        sources={[
          makeSource({ document_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }),
          makeSource({ document_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }),
        ]}
      />,
    )
    expect(screen.getByTestId('sources-trigger').textContent).toContain('引用 2 篇资料作为参考')
    expect(screen.queryByText('这是段落正文不应该默认展示')).toBeNull()
    expect(screen.queryByTestId('sources-docs-popover')).toBeNull()
  })

  it('opens local popover listing document names only', async () => {
    const user = userEvent.setup()
    render(
      <SourceCitations
        sources={[makeSource({ document_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' })]}
      />,
    )
    await user.click(screen.getByTestId('sources-trigger'))
    expect(screen.getByTestId('sources-docs-popover')).toBeTruthy()
    expect(screen.getByTestId('source-doc-item')).toBeTruthy()
    expect(screen.queryByText('这是段落正文不应该默认展示')).toBeNull()
  })

  it('delegates to onOpenPanel when provided', async () => {
    const onOpenPanel = vi.fn()
    const user = userEvent.setup()
    const sources = [makeSource({ document_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' })]
    render(<SourceCitations sources={sources} onOpenPanel={onOpenPanel} />)
    await user.click(screen.getByTestId('sources-trigger'))
    expect(onOpenPanel).toHaveBeenCalledWith(sources)
    expect(screen.queryByTestId('sources-docs-popover')).toBeNull()
  })

  it('shows empty retrieval hint without full panel', () => {
    render(<SourceCitations retrievalEmpty sources={[]} />)
    expect(screen.getByTestId('sources-empty')).toBeTruthy()
  })
})

describe('SourceDocsFloatingPanel', () => {
  it('renders floating list and close', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <SourceDocsFloatingPanel
        sources={[makeSource({ document_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' })]}
        onClose={onClose}
      />,
    )
    expect(screen.getByTestId('sources-floating-panel')).toBeTruthy()
    await user.click(screen.getByTestId('sources-panel-close'))
    expect(onClose).toHaveBeenCalled()
  })
})
