import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startSidecar, stopSidecar } from '../setup'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

let port: number
let dataDir: string

describe('settings API', () => {
  beforeAll(async () => {
    const s = await startSidecar()
    port = s.port
    dataDir = s.dataDir
  })

  afterAll(async () => {
    await stopSidecar()
  })

  it('returns default settings structure', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/settings`)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body).toHaveProperty('embeddingProvider')
    expect(body.embeddingProvider).toHaveProperty('provider')
    expect(body).toHaveProperty('defaultChatProvider')
    expect(body).toHaveProperty('providers')
    expect(body.providers).toHaveProperty('openai')
    expect(body.providers).toHaveProperty('deepseek')
    expect(body.providers).toHaveProperty('claude')
    expect(body.providers).toHaveProperty('custom')
    expect(body.providers).toHaveProperty('ollama')
    expect(body).toHaveProperty('temperature')
  })

  it('saves and reads back settings', async () => {
    const newConfig = {
      providers: {
        openai: { apiKey: '', model: 'gpt-4o', baseUrl: '' },
        claude: { apiKey: '', model: 'claude-3-5-sonnet-20241022', baseUrl: '' },
        deepseek: { apiKey: '', model: 'deepseek-chat', baseUrl: '' },
        custom: { apiKey: '', model: '', baseUrl: '' },
        ollama: { enabled: false, url: 'http://localhost:11434', model: '' },
      },
      embeddingProvider: { provider: 'openai', apiKey: '', model: 'text-embedding-3-small', baseUrl: '' },
      temperature: 0.5,
      defaultChatProvider: 'openai',
    }

    const postRes = await fetch(`http://127.0.0.1:${port}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    })
    expect(postRes.status).toBe(200)
    const postBody = await postRes.json()
    expect(postBody.success).toBe(true)

    const getRes = await fetch(`http://127.0.0.1:${port}/settings`)
    expect(getRes.status).toBe(200)
    const body = await getRes.json()
    expect(body.temperature).toBe(0.5)
    expect(body.defaultChatProvider).toBe('openai')
  })

  // DISCREPANCY: The plan expected apiKey to be masked or empty in GET responses.
  // Reality: the settings route returns the full config object including raw apiKey values.
  it('apiKey is exposed in plaintext (no masking yet)', async () => {
    const sensitiveConfig = {
      providers: {
        openai: { apiKey: 'sk-test-openai', model: 'gpt-4o', baseUrl: '' },
        claude: { apiKey: 'sk-test-claude', model: 'claude-3-5-sonnet-20241022', baseUrl: '' },
        deepseek: { apiKey: 'sk-test-deepseek', model: 'deepseek-chat', baseUrl: '' },
        custom: { apiKey: 'sk-test-custom', model: '', baseUrl: '' },
        ollama: { enabled: false, url: 'http://localhost:11434', model: '' },
      },
      embeddingProvider: { provider: 'openai', apiKey: 'sk-test-embedding', model: 'text-embedding-3-small', baseUrl: '' },
      temperature: 0.7,
      defaultChatProvider: 'deepseek',
    }

    const postRes = await fetch(`http://127.0.0.1:${port}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sensitiveConfig),
    })
    expect(postRes.status).toBe(200)

    const getRes = await fetch(`http://127.0.0.1:${port}/settings`)
    expect(getRes.status).toBe(200)
    const body = await getRes.json()

    // Current behavior: apiKey values are returned as-is
    expect(body.providers.openai.apiKey).toBe('sk-test-openai')
    expect(body.providers.claude.apiKey).toBe('sk-test-claude')
    expect(body.providers.deepseek.apiKey).toBe('sk-test-deepseek')
    expect(body.providers.custom.apiKey).toBe('sk-test-custom')
    expect(body.embeddingProvider.apiKey).toBe('sk-test-embedding')
  })

  // DISCREPANCY: The plan expected config.json to be encrypted on disk.
  // Reality: the file is stored as plain JSON.
  it('config file is stored as plain JSON on disk (not encrypted)', async () => {
    const configPath = join(dataDir, 'config.json')
    expect(existsSync(configPath)).toBe(true)

    const raw = readFileSync(configPath, 'utf-8')
    // Verify it is valid, readable JSON
    const parsed = JSON.parse(raw)
    expect(parsed).toHaveProperty('providers')
    expect(parsed).toHaveProperty('embeddingProvider')
  })

  // DISCREPANCY: The plan expected POST /settings to reject invalid provider config with 400.
  // Reality: the route accepts any JSON body without validation.
  it('accepts invalid provider config without validation', async () => {
    const invalidConfig = {
      providers: 'not-an-object',
      embeddingProvider: { provider: 'openai', apiKey: '', model: 'text-embedding-3-small', baseUrl: '' },
      temperature: 'hot',
      defaultChatProvider: 'deepseek',
    }

    const postRes = await fetch(`http://127.0.0.1:${port}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidConfig),
    })
    expect(postRes.status).toBe(200)
    const postBody = await postRes.json()
    expect(postBody.success).toBe(true)
  })
})
