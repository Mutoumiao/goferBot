import { describe, it, expect } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TestAppFactory } from '../../integration/helpers/test-app.factory.js'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures.js'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager.js'

const validSettings = {
  providers: {
    openai: { apiKey: '', model: 'gpt-4o', baseUrl: '' },
    claude: { apiKey: '', model: 'claude-3-5-sonnet-20241022', baseUrl: '' },
    deepseek: { apiKey: '', model: 'deepseek-chat', baseUrl: '' },
    custom: { apiKey: '', model: '', baseUrl: '' },
    ollama: { enabled: false, url: 'http://localhost:11434', model: '' },
  },
  embeddingProvider: { provider: 'openai', apiKey: '', model: 'text-embedding-3-small', baseUrl: '' },
  temperature: 0.7,
  defaultChatProvider: 'deepseek',
}

async function setupSettingsTest() {
  const dbManager = new TestDatabaseManager()
  const dbUrl = await dbManager.createDatabase('b06_settings')
  const app = await TestAppFactory.create(dbUrl)
  await AuthFixtures.createUser(app, AuthFixtures.normalUser)
  const token = await AuthFixtures.loginAs(app, AuthFixtures.normalUser)
  return { app, dbManager, dbUrl, token }
}

async function teardownSettingsTest(app: NestFastifyApplication, dbManager: TestDatabaseManager, dbUrl: string) {
  await app.close()
  const dbName = new URL(dbUrl).pathname.slice(1)
  await dbManager.dropDatabase(dbName)
}

describe('SettingsController', () => {
  it('AC-16: returns default settings', async () => {
    const { app, dbManager, dbUrl, token } = await setupSettingsTest()
    const res = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data).toHaveProperty('providers')
    expect(data).toHaveProperty('embeddingProvider')
    expect(data).toHaveProperty('temperature')
    expect(data).toHaveProperty('defaultChatProvider')
    await teardownSettingsTest(app, dbManager, dbUrl)
  })

  it('AC-17: saves and returns settings', async () => {
    const { app, dbManager, dbUrl, token } = await setupSettingsTest()
    const newSettings = {
      ...validSettings,
      temperature: 1.2,
      defaultChatProvider: 'openai',
    }

    const postRes = await app.inject({
      method: 'POST',
      url: '/api/settings',
      headers: { authorization: `Bearer ${token}` },
      payload: newSettings,
    })
    expect(postRes.statusCode).toBe(200)

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(getRes.statusCode).toBe(200)
    const data = getRes.json().data
    expect(data.temperature).toBe(1.2)
    expect(data.defaultChatProvider).toBe('openai')
    await teardownSettingsTest(app, dbManager, dbUrl)
  })

  it('AC-18: returns 400 for invalid temperature', async () => {
    const { app, dbManager, dbUrl, token } = await setupSettingsTest()
    const badSettings = {
      ...validSettings,
      temperature: 3.0,
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/settings',
      headers: { authorization: `Bearer ${token}` },
      payload: badSettings,
    })
    expect(res.statusCode).toBe(400)
    await teardownSettingsTest(app, dbManager, dbUrl)
  })

  it('AC-19: returns 400 for invalid baseUrl', async () => {
    const { app, dbManager, dbUrl, token } = await setupSettingsTest()
    const badSettings = {
      ...validSettings,
      providers: {
        ...validSettings.providers,
        openai: { apiKey: '', model: 'gpt-4o', baseUrl: 'http://192.168.1.1' },
      },
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/settings',
      headers: { authorization: `Bearer ${token}` },
      payload: badSettings,
    })
    expect(res.statusCode).toBe(400)
    await teardownSettingsTest(app, dbManager, dbUrl)
  })

  it('AC-20: returns 400 for invalid defaultChatProvider', async () => {
    const { app, dbManager, dbUrl, token } = await setupSettingsTest()
    const badSettings = {
      ...validSettings,
      defaultChatProvider: 'nonexistent-provider',
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/settings',
      headers: { authorization: `Bearer ${token}` },
      payload: badSettings,
    })
    expect(res.statusCode).toBe(400)
    await teardownSettingsTest(app, dbManager, dbUrl)
  })

  it('AC-23: returns 401 without token for settings endpoints', async () => {
    const { app, dbManager, dbUrl, token } = await setupSettingsTest()
    const res = await app.inject({
      method: 'GET',
      url: '/api/settings',
    })
    expect(res.statusCode).toBe(401)
    await teardownSettingsTest(app, dbManager, dbUrl)
  })
})
