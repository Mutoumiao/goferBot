import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { nanoid } from 'nanoid'
import db from '../db.js'
import { streamChatCompletion } from '../services/llm.js'
import { hybridSearch, buildRagPrompt } from '../services/rag.js'
import { getEmbeddingConfigFromSettings } from '../services/embedding.js'
import type { ChatRequest } from '../types.js'

const app = new Hono()

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
  let ragError: string | undefined
  if (knowledgeBaseIds && knowledgeBaseIds.length > 0) {
    try {
      const embeddingConfig = getEmbeddingConfigFromSettings()
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
      } else {
        ragError = 'Embedding 配置缺失，无法检索知识库'
      }
    } catch (err) {
      console.error('[chat] RAG retrieval failed:', err)
      ragError = '知识库检索失败，将直接回答'
    }
  }

  return streamSSE(c, async (stream) => {
    if (ragError) {
      await stream.writeSSE({ event: 'warning', data: JSON.stringify({ message: ragError }) })
    }

    let assistantContent = ''

    try {
      await streamChatCompletion(history, config, async (chunk) => {
        assistantContent += chunk
        await stream.writeSSE({ data: JSON.stringify({ content: chunk }) })
      })

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
      let errorType = 'unknown'
      let message = err instanceof Error ? err.message : 'Stream error'

      if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
        errorType = 'network_error'
      } else if (message.includes('LLM API error')) {
        errorType = 'api_error'
      }

      await stream.writeSSE({ event: 'error', data: JSON.stringify({ type: errorType, message }) })
    } finally {
      await stream.close()
    }
  })
})

export default app
