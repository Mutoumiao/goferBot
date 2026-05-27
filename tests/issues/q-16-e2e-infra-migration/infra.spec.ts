import { test, expect } from '@playwright/test'
import { existsSync } from 'fs'
import { Client } from 'pg'

test.describe('E2E Infrastructure (q-16)', () => {
  test('AC-01: Tauri e2e-full directory is removed', () => {
    expect(existsSync('tests/e2e-full')).toBe(false)
  })

  test('AC-08: .env.e2e loads correct database URL', () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeDefined()
    expect(dbUrl).toContain('goferbot_e2e')
  })

  test('AC-10: globalSetup starts docker infrastructure', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    const res = await client.query('SELECT 1')
    expect(res.rows[0]['?column?']).toBe(1)
    await client.end()
  })

  test('AC-10b: backend health check passes', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/health')
    expect(res.status()).toBe(200)
  })

  test('AC-11: playwright config has globalSetup and webServer timeout >= 120s', async () => {
    const configModule = await import('../playwright.config.ts')
    const config = configModule.default || configModule
    expect(config.globalSetup).toBeDefined()
    expect(config.webServer).toBeDefined()
    expect(config.webServer.timeout).toBeGreaterThanOrEqual(120000)
    expect(config.workers).toBe(1)
  })

  test('AC-04: database cleanup removes test data', async () => {
    const { cleanupDatabase } = await import('../fixtures/database')
    // 先创建用户
    const { createTestUser } = await import('../fixtures/auth')
    await createTestUser()
    // 清理
    await cleanupDatabase()
    // 验证
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    const res = await client.query('SELECT COUNT(*) FROM users')
    expect(parseInt(res.rows[0].count)).toBe(0)
    await client.end()
  })

  test('AC-05: auth fixture creates user and returns token', async () => {
    const { createTestUser } = await import('../fixtures/auth')
    const user = await createTestUser()
    expect(user.email).toContain('@test.gofer')
    expect(user.token).toBeDefined()
    expect(user.token.length).toBeGreaterThan(0)
  })
})
