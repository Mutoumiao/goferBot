import { describe, it, expect, vi } from 'vitest'
import { FakeBackendTransport } from '@/backend/fake-transport'

describe('FakeBackendTransport', () => {
  it('returns configured response', async () => {
    const backend = new FakeBackendTransport()
    backend.when('GET', '/knowledge-bases').respond(200, [{ id: '1', name: 'Test' }])

    const res = await backend.request('GET', '/knowledge-bases')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: '1', name: 'Test' }])
  })

  it('returns 404 when no mock configured', async () => {
    const backend = new FakeBackendTransport()
    const res = await backend.request('GET', '/unknown')
    expect(res.status).toBe(404)
  })

  it('records request history', async () => {
    const backend = new FakeBackendTransport()
    backend.when('POST', '/settings').respond(200, { success: true })

    await backend.request('POST', '/settings', { temperature: 1.0 })
    expect(backend.wasRequestCalled('POST', '/settings')).toBe(true)
    expect(backend.getRequestHistory()[0].body).toEqual({ temperature: 1.0 })
  })

  it('simulates SSE events', async () => {
    const backend = new FakeBackendTransport()
    const handler = vi.fn()

    backend.when('POST', '/chat').respondSSE([
      { data: '{"content":"hello"}', event: '' },
      { data: '{"content":"world"}', event: '' },
    ])

    const { completed } = backend.subscribe('/chat', { message: 'hi' }, handler)
    await completed
    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenNthCalledWith(1, '{"content":"hello"}', undefined)
    expect(handler).toHaveBeenNthCalledWith(2, '{"content":"world"}', undefined)
  })

  it('clears state on dispose', async () => {
    const backend = new FakeBackendTransport()
    backend.when('GET', '/test').respond(200, {})
    await backend.request('GET', '/test')

    backend.dispose()
    expect(backend.getRequestHistory()).toHaveLength(0)
    const res = await backend.request('GET', '/test')
    expect(res.status).toBe(404)
  })
})
