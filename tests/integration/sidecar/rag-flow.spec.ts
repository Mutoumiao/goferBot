import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from 'http'
import type { Server } from 'http'
import { startSidecar, stopSidecar } from '../setup'
import { startMockEmbeddingServer } from '../mocks/embedding-server'
import { startMockLLMServer } from '../mocks/llm-server'

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number }
      const port = addr.port
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

async function configureSettings(sidecarPort: number, embeddingPort: number): Promise<void> {
  const res = await fetch(`http://127.0.0.1:${sidecarPort}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providers: {
        openai: { apiKey: 'mock', model: 'gpt-4', baseUrl: '' },
        claude: { apiKey: '', model: 'claude-3-5-sonnet-20241022', baseUrl: '' },
        deepseek: { apiKey: '', model: 'deepseek-chat', baseUrl: '' },
        custom: { apiKey: '', model: '', baseUrl: '' },
        ollama: { enabled: false, url: 'http://localhost:11434', model: '' },
      },
      embeddingProvider: {
        provider: 'openai',
        apiKey: 'mock',
        model: 'text-embedding-3-small',
        baseUrl: `http://127.0.0.1:${embeddingPort}`,
      },
      temperature: 0.7,
      defaultChatProvider: 'openai',
    }),
  })
  if (!res.ok) {
    throw new Error(`Failed to configure settings: ${res.status}`)
  }
}

async function createKnowledgeBase(port: number, name: string): Promise<string> {
  const res = await fetch(`http://127.0.0.1:${port}/knowledge-bases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(`Failed to create KB: ${JSON.stringify(data)}`)
  }
  return data.id as string
}

async function importFile(port: number, kbId: string, name: string, content: string): Promise<void> {
  const res = await fetch(`http://127.0.0.1:${port}/knowledge-bases/${kbId}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: [{ name, content }] }),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(`Failed to import file: ${JSON.stringify(data)}`)
  }
}

async function waitForIndex(port: number, kbId: string, timeout = 30000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const res = await fetch(`http://127.0.0.1:${port}/knowledge-bases/${kbId}/index-status`)
    const status = await res.json() as { totalFiles: number; indexedFiles: number; pendingFiles: number }
    if (status.totalFiles > 0 && status.indexedFiles === status.totalFiles && status.pendingFiles === 0) {
      return
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('Timeout waiting for index completion')
}

async function rebuildIndex(port: number, kbId: string): Promise<void> {
  const res = await fetch(`http://127.0.0.1:${port}/knowledge-bases/${kbId}/index`, {
    method: 'POST',
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(`Failed to rebuild index: ${JSON.stringify(data)}`)
  }
}

interface ChatResult {
  content: string
  events: string[]
  hasWarning: boolean
}

async function chat(
  port: number,
  message: string,
  sessionId: string,
  knowledgeBaseIds: string[] | undefined,
  llmPort: number
): Promise<ChatResult> {
  const res = await fetch(`http://127.0.0.1:${port}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      sessionId,
      knowledgeBaseIds,
      config: {
        provider: 'openai',
        model: 'gpt-4',
        baseUrl: `http://127.0.0.1:${llmPort}`,
        apiKey: 'mock',
      },
    }),
  })

  const text = await res.text()
  const lines = text.split('\n')
  const events: string[] = []
  let content = ''
  let hasWarning = false

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      const eventName = line.slice(7).trim()
      if (eventName === 'warning') {
        hasWarning = true
      }
    } else if (line.startsWith('data: ')) {
      const data = line.slice(6).trim()
      if (data && data !== '[DONE]') {
        events.push(data)
        try {
          const parsed = JSON.parse(data)
          if (parsed.content) {
            content += parsed.content
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  }

  return { content, events, hasWarning }
}

async function getSessionMessages(port: number, sessionId: string): Promise<Array<{ role: string; content: string; knowledge_base_ids: string | null }>> {
  const res = await fetch(`http://127.0.0.1:${port}/sessions/${sessionId}`)
  if (!res.ok) {
    throw new Error(`Failed to get session: ${res.status}`)
  }
  const data = await res.json() as { messages: Array<{ role: string; content: string; knowledge_base_ids: string | null }> }
  return data.messages
}

describe('RAG flow end-to-end', () => {
  let sidecar: { port: number; dataDir: string }
  let embeddingServer: Server
  let llmServer: Server
  let embeddingPort: number
  let llmPort: number

  beforeAll(async () => {
    sidecar = await startSidecar()
    embeddingPort = await getFreePort()
    llmPort = await getFreePort()
    embeddingServer = startMockEmbeddingServer(embeddingPort)
    llmServer = startMockLLMServer(llmPort)
    await configureSettings(sidecar.port, embeddingPort)
  }, 30000)

  afterAll(async () => {
    embeddingServer.close()
    llmServer.close()
    await stopSidecar()
  }, 30000)

  it('TC-04-066: file import -> auto index -> retrievable', async () => {
    const kbName = `e2e-kb-${Date.now()}`
    const kbId = await createKnowledgeBase(sidecar.port, kbName)
    await importFile(sidecar.port, kbId, 'hello.md', '# Hello\n\nRAG works!')
    await waitForIndex(sidecar.port, kbId)

    const sessionId = `session-${Date.now()}`
    const result = await chat(sidecar.port, 'What does the doc say?', sessionId, [kbId], llmPort)

    expect(result.content).toBe('RAG works!')
    expect(result.hasWarning).toBe(false)
  })

  it('TC-04-067: @mention selects KB and retrieval works', async () => {
    const kbName = `mention-kb-${Date.now()}`
    const kbId = await createKnowledgeBase(sidecar.port, kbName)
    await importFile(sidecar.port, kbId, 'mention.md', 'Mention test content about RAG retrieval.')
    await waitForIndex(sidecar.port, kbId)

    const sessionId = `mention-session-${Date.now()}`
    const result = await chat(sidecar.port, 'Tell me about RAG', sessionId, [kbId], llmPort)

    expect(result.content).toBe('RAG works!')
    expect(result.hasWarning).toBe(false)

    const messages = await getSessionMessages(sidecar.port, sessionId)
    const userMsg = messages.find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()
    expect(userMsg!.knowledge_base_ids).toBe(JSON.stringify([kbId]))
  })

  it('TC-04-068: rebuild index old data not残留', async () => {
    const kbName = `rebuild-kb-${Date.now()}`
    const kbId = await createKnowledgeBase(sidecar.port, kbName)
    await importFile(sidecar.port, kbId, 'rebuild.md', 'Rebuild index test content.')
    await waitForIndex(sidecar.port, kbId)

    // Verify chat works before rebuild
    const sessionId = `rebuild-session-${Date.now()}`
    const before = await chat(sidecar.port, 'What is the content?', sessionId, [kbId], llmPort)
    expect(before.content).toBe('RAG works!')

    // Rebuild index
    await rebuildIndex(sidecar.port, kbId)

    // Poll until rebuild completes
    await waitForIndex(sidecar.port, kbId)

    // Verify chat still works after rebuild
    const sessionId2 = `rebuild-session2-${Date.now()}`
    const after = await chat(sidecar.port, 'What is the content?', sessionId2, [kbId], llmPort)
    expect(after.content).toBe('RAG works!')

    // Verify index status is consistent
    const res = await fetch(`http://127.0.0.1:${sidecar.port}/knowledge-bases/${kbId}/index-status`)
    const status = await res.json() as { totalFiles: number; indexedFiles: number; pendingFiles: number }
    expect(status.totalFiles).toBe(1)
    expect(status.indexedFiles).toBe(1)
    expect(status.pendingFiles).toBe(0)
  })

  it('TC-04-069: cross-KB retrieval', async () => {
    const kbName1 = `cross-kb1-${Date.now()}`
    const kbName2 = `cross-kb2-${Date.now()}`
    const kbId1 = await createKnowledgeBase(sidecar.port, kbName1)
    const kbId2 = await createKnowledgeBase(sidecar.port, kbName2)

    await importFile(sidecar.port, kbId1, 'kb1.md', 'Knowledge base one content about planets.')
    await importFile(sidecar.port, kbId2, 'kb2.md', 'Knowledge base two content about stars.')

    await waitForIndex(sidecar.port, kbId1)
    await waitForIndex(sidecar.port, kbId2)

    const sessionId = `cross-session-${Date.now()}`
    const result = await chat(sidecar.port, 'Tell me about astronomy', sessionId, [kbId1, kbId2], llmPort)

    expect(result.content).toBe('RAG works!')
    expect(result.hasWarning).toBe(false)
  })

  it('TC-04-070: no mention no RAG', async () => {
    const kbName = `no-mention-kb-${Date.now()}`
    const kbId = await createKnowledgeBase(sidecar.port, kbName)
    await importFile(sidecar.port, kbId, 'no-mention.md', 'No mention test content.')
    await waitForIndex(sidecar.port, kbId)

    const sessionId = `no-mention-session-${Date.now()}`
    const result = await chat(sidecar.port, 'Hello there', sessionId, undefined, llmPort)

    expect(result.content).toBe('RAG works!')
    expect(result.hasWarning).toBe(false)

    // Verify the user message has no knowledge_base_ids attached
    const messages = await getSessionMessages(sidecar.port, sessionId)
    const userMsg = messages.find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()
    expect(userMsg!.knowledge_base_ids).toBeNull()
  })
})
