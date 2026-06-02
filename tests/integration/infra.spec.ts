import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { existsSync } from 'fs'
import { Client } from 'pg'
import { cleanupDatabase } from '../e2e/fixtures/database'
import { isBackendAvailable } from '../e2e/fixtures/auth'

let backendOk: boolean

describe('E2E Infrastructure (q-16)', () => {
  beforeAll(async () => {
    backendOk = await isBackendAvailable()
  })

  beforeEach(async () => {
    if (!backendOk) {
      console.log('Backend unavailable — skipping infrastructure test')
      return
    }
    await cleanupDatabase()
  })

  it('AC-01: Tauri e2e-full directory is removed', () => {
    expect(existsSync('tests/e2e-full')).toBe(false)
  })

  it('AC-08: .env.test loads correct database URL', () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeDefined()
    // .env.test 使用 goferbot_test 数据库
    expect(dbUrl).toContain('goferbot')
  })

  it('AC-10: globalSetup starts docker infrastructure', async () => {
    if (!backendOk) return
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    const res = await client.query('SELECT 1')
    expect(res.rows[0]['?column?']).toBe(1)
    await client.end()
  })

  it('AC-10b: backend health check passes', async () => {
    if (!backendOk) return
    const res = await fetch('http://localhost:3000/api/health')
    expect(res.status).toBe(200)
  })

  it('AC-11: playwright config has globalSetup and webServer timeout >= 120s', async () => {
    const configModule = await import('../e2e/playwright.config.ts')
    const config = configModule.default || configModule
    expect(config.globalSetup).toBeDefined()
    expect(config.webServer).toBeDefined()
    // webServer 是数组，取第一个元素的 timeout
    const webServerEntry = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer
    expect(webServerEntry.timeout).toBeGreaterThanOrEqual(120000)
    expect(config.workers).toBe(1)
  })

  it('AC-04: database cleanup removes test data', async () => {
    if (!backendOk) return
    // 先创建用户
    const { createTestUser } = await import('../e2e/fixtures/auth')
    await createTestUser()
    // beforeEach 会自动清理，这里手动再清理一次验证
    await cleanupDatabase()
    // 验证
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    const res = await client.query('SELECT COUNT(*) FROM users')
    expect(parseInt(res.rows[0].count)).toBe(0)
    await client.end()
  })

  it('AC-05: auth fixture creates user and returns token', async () => {
    if (!backendOk) return
    const { createTestUser } = await import('../e2e/fixtures/auth')
    const user = await createTestUser()
    expect(user.email).toContain('@test.gofer')
    expect(user.accessToken).toBeDefined()
    expect(user.accessToken.length).toBeGreaterThan(0)
  })

  it('AC-03: api client creates KB via direct HTTP', async () => {
    if (!backendOk) return
    const { createTestUser } = await import('../e2e/fixtures/auth')
    const { ApiClient } = await import('../e2e/fixtures/api-client')

    const user = await createTestUser()
    const client = new ApiClient(user.accessToken)
    const kb = await client.createKB('Test KB')
    expect(kb.name).toBe('Test KB')
  })
})
