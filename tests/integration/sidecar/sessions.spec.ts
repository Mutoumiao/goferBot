import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startSidecar, stopSidecar } from '../setup'

let port: number

describe('sessions API', () => {
  beforeAll(async () => {
    const s = await startSidecar()
    port = s.port
  })

  afterAll(async () => {
    await stopSidecar()
  })

  it('lists sessions', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/sessions`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  it('creates session', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Session' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBeDefined()
    expect(body.title).toBe('Test Session')
    expect(body.message_count).toBe(0)
  })

  it('renames session', async () => {
    const createRes = await fetch(`http://127.0.0.1:${port}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Old Name' }),
    })
    const session = await createRes.json()

    const renameRes = await fetch(`http://127.0.0.1:${port}/sessions/${session.id}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Name' }),
    })
    expect(renameRes.status).toBe(200)

    const getRes = await fetch(`http://127.0.0.1:${port}/sessions/${session.id}`)
    expect(getRes.status).toBe(200)
    const data = await getRes.json()
    expect(data.title).toBe('New Name')
  })

  it('deletes session with cascade', async () => {
    const createRes = await fetch(`http://127.0.0.1:${port}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'To Delete' }),
    })
    const session = await createRes.json()

    const delRes = await fetch(`http://127.0.0.1:${port}/sessions/${session.id}`, {
      method: 'DELETE',
    })
    expect(delRes.status).toBe(200)

    const getRes = await fetch(`http://127.0.0.1:${port}/sessions/${session.id}`)
    expect(getRes.status).toBe(404)
  })

  it('deleted session not accessible', async () => {
    const createRes = await fetch(`http://127.0.0.1:${port}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Temporary' }),
    })
    const session = await createRes.json()

    const delRes = await fetch(`http://127.0.0.1:${port}/sessions/${session.id}`, {
      method: 'DELETE',
    })
    expect(delRes.status).toBe(200)

    const getRes = await fetch(`http://127.0.0.1:${port}/sessions/${session.id}`)
    expect(getRes.status).toBe(404)
    const data = await getRes.json()
    expect(data.error).toBe('Session not found')
  })
})
