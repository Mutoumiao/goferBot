import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import db from '../db.js'

const app = new Hono()

app.post('/', async (c) => {
  const { title } = await c.req.json<{ title: string }>()
  const trimmed = title?.trim()
  if (!trimmed) {
    return c.json({ error: 'Title is required' }, 400)
  }
  const id = nanoid()
  const now = Date.now()
  db.prepare(
    'INSERT INTO sessions (id, title, provider, model, created_at, updated_at, message_count) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, trimmed, null, null, now, now, 0)
  return c.json({ id, title: trimmed, created_at: now, updated_at: now, message_count: 0 })
})

app.get('/', (c) => {
  const rows = db
    .prepare(`
      SELECT
        s.id,
        s.title,
        s.provider,
        s.model,
        s.created_at,
        s.updated_at,
        s.message_count,
        (SELECT content FROM messages WHERE session_id = s.id ORDER BY created_at DESC LIMIT 1) as last_message
      FROM sessions s
      ORDER BY s.updated_at DESC
    `)
    .all() as Array<{
      id: string
      title: string
      provider: string | null
      model: string | null
      created_at: number
      updated_at: number
      message_count: number
      last_message: string | null
    }>

  const sessions = rows.map((r) => ({
    id: r.id,
    title: r.title,
    provider: r.provider,
    model: r.model,
    created_at: r.created_at,
    updated_at: r.updated_at,
    message_count: r.message_count,
    summary: r.last_message
      ? r.last_message.slice(0, 100) + (r.last_message.length > 100 ? '...' : '')
      : '',
  }))

  return c.json(sessions)
})

app.get('/:id', (c) => {
  const id = c.req.param('id')
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
    | {
        id: string
        title: string
        provider: string | null
        model: string | null
        created_at: number
        updated_at: number
        message_count: number
      }
    | undefined

  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  const messages = db
    .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(id)

  return c.json({ ...session, messages })
})

app.post('/:id/rename', async (c) => {
  const id = c.req.param('id')
  const { title } = await c.req.json<{ title: string }>()
  const trimmed = title?.trim()
  if (!trimmed) {
    return c.json({ error: 'Title is required' }, 400)
  }
  const result = db
    .prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?')
    .run(trimmed, Date.now(), id)
  if (result.changes === 0) {
    return c.json({ error: 'Session not found' }, 404)
  }
  return c.json({ success: true })
})

app.delete('/:id', (c) => {
  const id = c.req.param('id')
  db.prepare('DELETE FROM messages WHERE session_id = ?').run(id)
  const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
  if (result.changes === 0) {
    return c.json({ error: 'Session not found' }, 404)
  }
  return c.json({ success: true })
})

export default app
