import { test, expect } from '@playwright/test'
import { cleanupDatabase } from '../../e2e/fixtures/database'
import { AuthPage } from '../../e2e/pages/AuthPage'

test.describe('认证流程 (q-17)', () => {
  test.beforeEach(async () => {
    await cleanupDatabase()
  })

  test('AC-01: 注册页面元素完整', async ({ page }) => {
    const auth = new AuthPage(page)
    await auth.gotoRegister()
    await expect(auth.emailInput).toBeVisible()
    await expect(auth.passwordInput).toBeVisible()
    await expect(auth.confirmPasswordInput).toBeVisible()
    await expect(auth.submitButton).toBeVisible()
    await expect(auth.submitButton).toBeEnabled()
  })
})
