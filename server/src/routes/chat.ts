import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import fs from 'node:fs'
import path from 'node:path'
import { nanoid } from 'nanoid'
import db from '../db.js'
import { streamChatCompletion } from '../services/llm.js'
import { hybridSearch, buildRagPrompt } from '../services/rag.js'
import { getAppDataDir } from '../utils.js'
import type { ChatRequest, EmbeddingConfig } from '../types.js'

const app = new Hono()

function getEmbeddingConfig(): EmbeddingConfig | null {
  const configPath = path.join(getAppDataDir(), 'config.json')
  if (!fs.existsSync(configPath)) return null
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    const ec = config.embeddingProvider
    if (!ec || !ec.apiKey) return null
    return {
      provider: ec.provider || 'openai',
      model: ec.model || 'text-embedding-3-small',
      baseUrl: ec.baseUrl || '',
      apiKey: ec.apiKey,
    }
  } catch {
    return null
  }
}

app.post('/', async (c) => {
  const body = await c.req.json<ChatRequest>()
  const { message, sessionId, knowledgeBaseIds, config } = body

  // Auto-create session if it does not exist (home tab promotion)
  const existingSession = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId)
  if (!existingSession) {
    const title = message.slice(0, 20) + (message.length > 20 ? '...' : '')
    const now = Date.now()
    db.prepare(
      'INSERT INTO sessions (id, title, provider, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(sessionId, title, config.provider, config.model, now, now)
  }

  // Save user message with knowledge_base_ids
  const now = Date.now()
  const userMessageId = nanoid()
  const kbIdsJson = knowledgeBaseIds && knowledgeBaseIds.length > 0 ? JSON.stringify(knowledgeBaseIds) : null
  db.prepare(
    'INSERT INTO messages (id, session_id, role, content, knowledge_base_ids, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userMessageId, sessionId, 'user', message, kbIdsJson, now)

  // Update session
  db.prepare('UPDATE sessions SET updated_at = ?, message_count = message_count + 1 WHERE id = ?').run(
    now,
    sessionId
  )

  // Build history for LLM
  const history = db
    .prepare('SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 50')
    .all(sessionId) as Array<{ role: string; content: string }>

  // RAG retrieval
  let systemPrompt: string | undefined
  if (knowledgeBaseIds && knowledgeBaseIds.length > 0) {
    try {
      const embeddingConfig = getEmbeddingConfig()
      if (embeddingConfig) {
        const chunks = await hybridSearch(message, knowledgeBaseIds, embeddingConfig)
        if (chunks.length > 0) {
          const ragMessage = buildRagPrompt(chunks, message)
          for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].role === 'user') {
              history[i].content = ragMessage
              break
            }
          }
        }
      }
    } catch (err) {
      console.error('[chat] RAG retrieval failed:', err)
    }
  }

  return streamSSE(c, async (stream) => {
    let assistantContent = ''

    try {
      await streamChatCompletion(history, config, async (chunk) => {
        assistantContent += chunk
        await stream.writeSSE({ data: JSON.stringify({ content: chunk }) })
      }, systemPrompt)

      // Save assistant message after stream completes
      const assistantId = nanoid()
      db.prepare(
        'INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(assistantId, sessionId, 'assistant', assistantContent, Date.now())

      db.prepare('UPDATE sessions SET updated_at = ?, message_count = message_count + 1 WHERE id = ?').run(
        Date.now(),
        sessionId
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stream error'
      await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: message }) })
    } finally {
      await stream.close()
    }
  })
})

export default app
