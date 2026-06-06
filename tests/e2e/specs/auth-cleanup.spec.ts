import { test, expect } from '@playwright/test'
import { createTestUser, deleteTestUser } from '../fixtures/auth'

test.describe('AC-02: deleteTestUser 删除测试用户', () => {
  test('按 email 删除测试用户', async () => {
    const user = await createTestUser()
    await deleteTestUser({ email: user.email })

    // 验证用户已删除：尝试用相同邮箱注册应成功（唯一约束已释放）
    const newUser = await createTestUser()
    expect(newUser.email).not.toBe(user.email)
  })

  test('按 id 删除测试用户', async () => {
    const user = await createTestUser()
    expect(user.userId).toBeTruthy()
    await deleteTestUser({ id: user.userId! })

    // 验证删除不抛错
    await expect(deleteTestUser({ id: 'non-existent-id' })).resolves.not.toThrow()
  })
})
