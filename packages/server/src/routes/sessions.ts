import { Hono } from 'hono'

const app = new Hono()

// POST /sessions
app.post('/', (c) => c.json({ error: 'Not implemented' }, 501))

// GET /sessions
app.get('/', (c) => c.json({ error: 'Not implemented' }, 501))

// GET /sessions/:id
app.get('/:id', (c) => c.json({ error: 'Not implemented' }, 501))

// POST /sessions/:id/rename
app.post('/:id/rename', (c) => c.json({ error: 'Not implemented' }, 501))

// DELETE /sessions/:id
app.delete('/:id', (c) => c.json({ error: 'Not implemented' }, 501))

export default app
