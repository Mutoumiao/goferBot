/**
 * Admin 端真实后端登录（HttpOnly Cookie + 验证码占位）
 *
 * 默认账号与 Web 共用 seed 管理员；可通过环境变量覆盖。
 */
import { expect, type Page } from '@playwright/test'

export function adminCredentials() {
  return {
    email: process.env.ADMIN_EMAIL || process.env.WEB_EMAIL || 'admin@goferbot.local',
    password: process.env.ADMIN_PASSWORD || process.env.WEB_PASSWORD || 'AdminGoferBot2123',
  }
}

/** 登录 Admin 并等待进入 /dashboard */
export async function loginAsAdmin(page: Page): Promise<void> {
  const { email, password } = adminCredentials()

  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await expect(page.getByPlaceholder('请输入管理员邮箱')).toBeVisible({ timeout: 15_000 })

  await page.getByPlaceholder('请输入管理员邮箱').fill(email)
  await page.getByPlaceholder('请输入密码（至少 8 位）').fill(password)

  const captcha = page.getByPlaceholder('请输入验证码')
  if (await captcha.isVisible().catch(() => false)) {
    await expect(page.getByRole('img', { name: '验证码' })).toBeVisible({ timeout: 15_000 })
    await captcha.fill('TEST')
    await expect(captcha).toHaveValue('TEST')
  }

  // 按钮文案为「登 录 后 台」（字间空格），用 submit 更稳
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        (r.url().includes('/admin/auth/login') ||
          r.url().includes('/web/auth/login') ||
          r.url().includes('/auth/login')),
      { timeout: 20_000 },
    ),
    page.locator('button[type="submit"]').click(),
  ])

  expect(response.ok(), `Admin 登录失败 status=${response.status()}`).toBeTruthy()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })
}
