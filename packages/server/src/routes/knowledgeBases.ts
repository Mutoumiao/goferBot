import { Hono } from 'hono'

const app = new Hono()

// GET /knowledge-bases
app.get('/', (c) => c.json({ error: 'Not implemented' }, 501))

// POST /knowledge-bases
app.post('/', (c) => c.json({ error: 'Not implemented' }, 501))

// PATCH /knowledge-bases/:id
app.patch('/:id', (c) => c.json({ error: 'Not implemented' }, 501))

// DELETE /knowledge-bases/:id
app.delete('/:id', (c) => c.json({ error: 'Not implemented' }, 501))

// POST /knowledge-bases/:id/restore
app.post('/:id/restore', (c) => c.json({ error: 'Not implemented' }, 501))

// GET /knowledge-bases/:id/files
app.get('/:id/files', (c) => c.json({ error: 'Not implemented' }, 501))

// POST /knowledge-bases/:id/files
app.post('/:id/files', (c) => c.json({ error: 'Not implemented' }, 501))

// GET /knowledge-bases/:id/search
app.get('/:id/search', (c) => c.json({ error: 'Not implemented' }, 501))

// POST /knowledge-bases/:id/folders
app.post('/:id/folders', (c) => c.json({ error: 'Not implemented' }, 501))

// PATCH /knowledge-bases/:id/files/*
app.patch('/:id/files/*', (c) => c.json({ error: 'Not implemented' }, 501))

// POST /knowledge-bases/move
app.post('/move', (c) => c.json({ error: 'Not implemented' }, 501))

// POST /knowledge-bases/copy
app.post('/copy', (c) => c.json({ error: 'Not implemented' }, 501))

// GET /knowledge-bases/deleted
app.get('/deleted', (c) => c.json({ error: 'Not implemented' }, 501))

// DELETE /knowledge-bases/:id/permanent
app.delete('/:id/permanent', (c) => c.json({ error: 'Not implemented' }, 501))

// DELETE /knowledge-bases/:id/files/*
app.delete('/:id/files/*', (c) => c.json({ error: 'Not implemented' }, 501))

// POST /knowledge-bases/:id/index
app.post('/:id/index', (c) => c.json({ error: 'Not implemented' }, 501))

// GET /knowledge-bases/:id/index-status
app.get('/:id/index-status', (c) => c.json({ error: 'Not implemented' }, 501))

export default app
