import { describe, it, expect } from 'vitest'
import nock from 'nock'
import { ExternalServiceMocker } from '../../integration/helpers/external-service.mocker'

describe('ExternalServiceMocker', () => {
  it('AC-04: intercepts OpenAI request and returns SSE stream', async () => {
    ExternalServiceMocker.mockLLMStream('hello from mock')

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [] }),
    })
    const text = await res.text()
    expect(text).toContain('hello from mock')
    expect(res.headers.get('content-type')).toContain('text/event-stream')

    ExternalServiceMocker.cleanAll()
  })

  it('AC-04: intercepts Embedding request and returns vector', async () => {
    ExternalServiceMocker.mockEmbedding(new Array(1536).fill(0.1))

    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: 'test' }),
    })
    const json = (await res.json()) as any
    expect(json.data[0].embedding).toHaveLength(1536)
    expect(json.data[0].embedding[0]).toBe(0.1)

    ExternalServiceMocker.cleanAll()
  })
})
