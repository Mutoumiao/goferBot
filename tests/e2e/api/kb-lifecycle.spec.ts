/**
 * KB 生命周期 E2E 测试
 * 覆盖：创建 → 列表 → 更新 → 删除
 * 场景：happy path、认证缺失
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { E2EClient } from './helpers/e2e-client.js'
import { cleanupDatabase } from './helpers/db-cleanup.js'
import { publicEncrypt, constants } from 'node:crypto'

describe('KB Lifecycle E2E', () => {
  let client: E2EClient

  beforeAll(async () => {
    client = new E2EClient()
  })

  beforeEach(async () => {
    await cleanupDatabase()
  })

  async function createUserAndLogin(): Promise<string> {
    const keyRes = await client.getPublicKey()
    const publicKey = keyRes.data.data.publicKey
    const password = 'Test1234!'
    const encrypted = publicEncrypt(
      { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(password),
    )
    const encryptedPassword = encrypted.toString('base64')

    const email = `kb-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@test.gofer`
    const registerRes = await client.register(email, encryptedPassword, 'KB E2E')
    const token = registerRes.data.data.accessToken
    client.setToken(token)
    return token
  }

  it('AC-07: creates KB with valid data', async () => {
    await createUserAndLogin()
    const res = await client.createKB('E2E KB', 'Test description')
    expect(res.status).toBe(201)
    expect(res.data.data.name).toBe('E2E KB')
    expect(res.data.data.description).toBe('Test description')
  })

  it('AC-08: lists KBs', async () => {
    await createUserAndLogin()
    await client.createKB('KB 1')
    await client.createKB('KB 2')

    const res = await client.listKBs()
    expect(res.status).toBe(200)
    expect(res.data.data).toBeInstanceOf(Array)
    expect(res.data.data.length).toBe(2)
  })

  it('AC-09: updates KB', async () => {
    await createUserAndLogin()
    const createRes = await client.createKB('Old Name')
    const kbId = createRes.data.data.id

    const res = await client.updateKB(kbId, { name: 'New Name' })
    expect(res.status).toBe(200)
    expect(res.data.data.name).toBe('New Name')
  })

  it('AC-10: deletes KB', async () => {
    await createUserAndLogin()
    const createRes = await client.createKB('To Delete')
    const kbId = createRes.data.data.id

    const deleteRes = await client.deleteKB(kbId)
    expect(deleteRes.status).toBe(200)
    expect(deleteRes.data.data.deleted).toBe(true)

    const listRes = await client.listKBs()
    expect(listRes.data.data.find((kb: any) => kb.id === kbId)).toBeUndefined()
  })

  it('AC-11: returns 401 without token', async () => {
    await createUserAndLogin()
    client.clearToken()
    const res = await client.listKBs()
    expect(res.status).toBe(401)
  })
})
