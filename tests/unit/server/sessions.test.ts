// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const testDir = path.join(os.tmpdir(), `kb-sessions-test-${Date.now()}`)
process.env.APP_DATA_DIR = testDir

const { default: app } = await import('../../../../server/src/routes/sessions.js')
const { default: db } = await import('../../../../server/src/db.js')

beforeAll(() => {
  fs.mkdirSync(testDir, { recursive: true })
})

afterAll(() => {
  db.close()
  fs.rmSync(testDir, { recursive: true, force: true })
})

beforeEach(() => {
  db.exec('DELETE FROM messages')
  db.exec('DELETE FROM sessions')
})

describe('GET /sessions', () => {
  it('returns empty list initially', async () => {
    const res = await app.request('/')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([])
  })

  it('returns sessions ordered by updated_at desc', async () => {
    db.prepare(
      'INSERT INTO sessions (id, title, created_at, updated_at, message_count) VALUES (?, ?, ?, ?, ?)'
    ).run('s1', 'First', 1, 3, 0)
    db.prepare(
      'INSERT INTO sessions (id, title, created_at, updated_at, message_count) VALUES (?, ?, ?, ?, ?)'
    ).run('s2', 'Second', 2, 2, 0)

    const res = await app.request('/')
    const data = await res.json()
    expect(data).toHaveLength(2)
    expect(data[0].id).toBe('s1')
    expect(data[1].id).toBe('s2')
  })

  it('includes summary from last message truncated to 100 chars', async () => {
    db.prepare(
      'INSERT INTO sessions (id, title, created_at, updated_at, message_count) VALUES (?, ?, ?, ?, ?)'
    ).run('s1', 'Test', 1, 1, 1)
    db.prepare(
      'INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(
      'm1',
      's1',
      'user',
      'This is a very long message that should definitely be truncated for the summary view in the history page because it exceeds one hundred characters easily.',
      1
    )

    const res = await app.request('/')
    const data = await res.json()
    expect(data[0].summary).toBe(
      'This is a very long message that should definitely be truncated for the summary view in the history ...'
    )
  })

  it('returns empty summary when no messages', async () => {
    db.prepare(
      'INSERT INTO sessions (id, title, created_at, updated_at, message_count) VALUES (?, ?, ?, ?, ?)'
    ).run('s1', 'Empty', 1, 1, 0)

    const res = await app.request('/')
    const data = await res.json()
    expect(data[0].summary).toBe('')
  })
})

describe('POST /sessions/:id/rename', () => {
  it('updates session title', async () => {
    db.prepare(
      'INSERT INTO sessions (id, title, created_at, updated_at, message_count) VALUES (?, ?, ?, ?, ?)'
    ).run('s1', 'Old', 1, 1, 0)

    const res = await app.request('/s1/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Title' }),
    })
    expect(res.status).toBe(200)

    const row = db.prepare('SELECT title FROM sessions WHERE id = ?').get('s1') as { title: string }
    expect(row.title).toBe('New Title')
  })

  it('returns 400 for empty title', async () => {
    db.prepare(
      'INSERT INTO sessions (id, title, created_at, updated_at, message_count) VALUES (?, ?, ?, ?, ?)'
    ).run('s1', 'Old', 1, 1, 0)

    const res = await app.request('/s1/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '  ' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /sessions/:id', () => {
  it('removes session and its messages', async () => {
    db.prepare(
      'INSERT INTO sessions (id, title, created_at, updated_at, message_count) VALUES (?, ?, ?, ?, ?)'
    ).run('s1', 'ToDelete', 1, 1, 1)
    db.prepare(
      'INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run('m1', 's1', 'user', 'hi', 1)

    const res = await app.request('/s1', { method: 'DELETE' })
    expect(res.status).toBe(200)

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get('s1')
    expect(session).toBeUndefined()
    const message = db.prepare('SELECT * FROM messages WHERE session_id = ?').get('s1')
    expect(message).toBeUndefined()
  })
})
