import { Hono } from 'hono'
import db from '../db.js'

const app = new Hono()

app.get('/', (c) => {
  const rows = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all()
  return c.json(rows)
})

app.get('/:id', (c) => {
  const id = c.req.param('id')
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
    | { id: string; title: string; provider: string | null; model: string | null; created_at: number; updated_at: number; message_count: number }
    | undefined

  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  const messages = db
    .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(id)

  return c.json({ ...session, messages })
})

export default app
