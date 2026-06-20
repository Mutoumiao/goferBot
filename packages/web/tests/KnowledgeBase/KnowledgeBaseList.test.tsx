import type { KbEntry } from '@goferbot/data'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

// mock services 必须置于 import 组件之前
vi.mock('@/features/KnowledgeBase/services', () => ({
  fetchKbList: vi.fn(),
  pinKnowledgeBase: vi.fn(),
  removeKnowledgeBaseAndClearSelection: vi.fn(),
  loadKbItems: vi.fn(),
}))

import { KnowledgeBaseList } from '@/features/KnowledgeBase/components/KnowledgeBaseList'
import { loadKbItems } from '@/features/KnowledgeBase/services'
import { useKbStore } from '@/features/KnowledgeBase/store'

function makeEntry(id: string, name: string): KbEntry {
  return {
    id,
    name,
    description: '',
    isPinned: false,
    fileCount: 0,
    createdAt: '2026-06-17T08:00:00.000Z',
    updatedAt: '2026-06-17T08:00:00.000Z',
  } as KbEntry
}

function resetStore() {
  useKbStore.setState({
    entries: [],
    isLoading: false,
    selectedId: null,
    currentKbId: null,
  })
}

afterEach(() => {
  vi.clearAllMocks()
  resetStore()
})

describe('KnowledgeBaseList 选中知识库', () => {
  it('点击知识库条目后应加载该知识库的内容（设置 currentKbId）', async () => {
    const user = userEvent.setup()
    const entry = makeEntry('kb-1', '我的知识库')
    useKbStore.setState({ entries: [entry], isLoading: false })

    render(<KnowledgeBaseList sidebarOpen onToggle={vi.fn()} loadError={null} onRetry={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '选择知识库 我的知识库' }))

    // 回归断言：选中知识库必须触发 loadKbItems，否则 currentKbId 永远为 null，
    // 进而导致 FileBrowser 的上传按钮静默吞咽（点击上传选完文件后无任何反应）
    expect(loadKbItems).toHaveBeenCalledWith('kb-1')
    expect(useKbStore.getState().selectedId).toBe('kb-1')
  })
})
