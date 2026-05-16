import { Hono } from 'hono'

const app = new Hono()

// GET /settings
app.get('/', (c) => c.json({ error: 'Not implemented' }, 501))

// POST /settings
app.post('/', (c) => c.json({ error: 'Not implemented' }, 501))

export default app
