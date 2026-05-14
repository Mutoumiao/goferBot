// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const testDir = path.join(os.tmpdir(), `kb-settings-test-${Date.now()}`)
process.env.APP_DATA_DIR = testDir

const { default: settingsApp, DEFAULT_CONFIG } = await import('../../../server/src/routes/settings.js')

describe('settings API', () => {
  beforeEach(() => {
    const configPath = path.join(testDir, 'config.json')
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath)
    }
  })

  it('GET / returns default config when file missing', async () => {
    const res = await settingsApp.request('/')
    const data = await res.json()
    expect(data.defaultChatProvider).toBe('deepseek')
    expect(data.temperature).toBe(0.7)
    expect(data.providers.openai.model).toBe('gpt-4o')
  })

  it('POST / saves config and subsequent GET returns it', async () => {
    const newConfig = {
      ...DEFAULT_CONFIG,
      temperature: 1.2,
      defaultChatProvider: 'openai',
    }

    const postRes = await settingsApp.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    })
    expect(postRes.status).toBe(200)

    const getRes = await settingsApp.request('/')
    const data = await getRes.json()
    expect(data.temperature).toBe(1.2)
    expect(data.defaultChatProvider).toBe('openai')
  })
})
