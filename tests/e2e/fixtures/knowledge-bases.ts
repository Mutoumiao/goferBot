export const mockKnowledgeBases = [
  {
    id: 'kb1',
    name: '技术文档',
    icon: 'mdi-books',
    is_pinned: 1,
    sort_order: 0,
    path: 'docs/技术文档',
    created_at: '2026-05-01T08:00:00Z',
    deleted_at: null,
  },
  {
    id: 'kb2',
    name: '会议记录',
    icon: 'mdi-notebook',
    is_pinned: 0,
    sort_order: 1,
    path: 'docs/会议记录',
    created_at: '2026-05-02T10:00:00Z',
    deleted_at: null,
  },
]

export const mockFiles = [
  { name: 'intro.md', type: 'file', size: 1024, updatedAt: '2026-05-08T10:00:00Z' },
  { name: 'notes', type: 'directory', size: 0, updatedAt: '2026-05-07T09:00:00Z' },
]

export const mockIndexStatus = {
  totalFiles: 10,
  indexedFiles: 7,
  pendingFiles: 2,
}
