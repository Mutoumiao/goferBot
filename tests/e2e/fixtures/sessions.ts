export const mockSessions = [
  {
    id: 'sess1',
    title: 'RAG 使用讨论',
    summary: '你好，请问如何使用 RAG？',
    lastMessageAt: '2026-05-08T14:30:00Z',
    provider: 'openai',
    model: 'gpt-4o',
  },
  {
    id: 'sess2',
    title: '知识库导入问题',
    summary: '导入文件后没有自动索引',
    lastMessageAt: '2026-05-07T09:15:00Z',
    provider: 'claude',
    model: 'claude-3-opus',
  },
]

export const mockMessages = [
  { id: 'm1', role: 'user', content: '你好，请问如何使用 RAG？', created_at: '2026-05-08T14:00:00Z' },
  { id: 'm2', role: 'assistant', content: 'RAG（检索增强生成）是一种将知识库检索与 LLM 结合的技术...', created_at: '2026-05-08T14:30:00Z' },
]
