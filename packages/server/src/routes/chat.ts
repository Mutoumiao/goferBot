import { Hono } from 'hono'

const app = new Hono()

// POST /chat
app.post('/', (c) => c.json({ error: 'Not implemented' }, 501))

export default app
