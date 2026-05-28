import { test, expect } from '@playwright/test'
import { existsSync } from 'fs'
import { Client } from 'pg'
import { cleanupDatabase } from '../e2e/fixtures/database'
import { isBackendAvailable } from '../e2e/fixtures/auth'

let backendOk: boolean

test.describe('E2E Infrastructure (q-16)', () => {
  test.beforeAll(async () => {
    backendOk = await isBackendAvailable()
  })

  test.beforeEach(async () => {
    test.skip(!backendOk, 'Backend unavailable — skipping infrastructure test')
    await cleanupDatabase()
  })

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
    // 先创建用户
    const { createTestUser } = await import('../fixtures/auth')
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

  test('AC-05: auth fixture creates user and returns token', async () => {
    const { createTestUser } = await import('../fixtures/auth')
    const user = await createTestUser()
    expect(user.email).toContain('@test.gofer')
    expect(user.accessToken).toBeDefined()
    expect(user.accessToken.length).toBeGreaterThan(0)
  })

  test('AC-03: api client creates KB via direct HTTP', async () => {
    const { createTestUser } = await import('../fixtures/auth')
    const { ApiClient } = await import('../fixtures/api-client')

    const user = await createTestUser()
    const client = new ApiClient(user.accessToken)
    const kb = await client.createKB('Test KB')
    expect(kb.name).toBe('Test KB')
  })
})
