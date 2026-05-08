import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { nanoid } from 'nanoid'
import db from '../db.js'
import { streamChatCompletion } from '../services/llm.js'
import type { ChatRequest } from '../types.js'

const app = new Hono()

app.post('/', async (c) => {
  const body = await c.req.json<ChatRequest>()
  const { message, sessionId, config } = body

  // Auto-create session if it does not exist (home tab promotion)
  const existingSession = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId)
  if (!existingSession) {
    const title = message.slice(0, 20) + (message.length > 20 ? '...' : '')
    const now = Date.now()
    db.prepare(
      'INSERT INTO sessions (id, title, provider, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(sessionId, title, config.provider, config.model, now, now)
  }

  // Save user message
  const now = Date.now()
  const userMessageId = nanoid()
  db.prepare(
    'INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(userMessageId, sessionId, 'user', message, now)

  // Update session
  db.prepare('UPDATE sessions SET updated_at = ?, message_count = message_count + 1 WHERE id = ?').run(
    now,
    sessionId
  )

  // Build history for LLM
  const history = db
    .prepare('SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 50')
    .all(sessionId) as Array<{ role: string; content: string }>

  return streamSSE(c, async (stream) => {
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
      const message = err instanceof Error ? err.message : 'Stream error'
      await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: message }) })
    } finally {
      await stream.close()
    }
  })
})

export default app
