/**
 * Web 端真实后端登录（HttpOnly Cookie + 验证码占位）
 *
 * 与 scripts/verify-rag-e2e.mjs 默认账号一致，便于 RAG / KB 联调。
 */
import { expect, type Page } from '@playwright/test'
import { AuthPage } from '../pages/AuthPage'

export function webCredentials() {
  return {
    email: process.env.WEB_EMAIL || 'admin@goferbot.local',
    password: process.env.WEB_PASSWORD || 'AdminGoferBot2123',
  }
}

/** 登录并等待进入 /chats 工作区 */
export async function loginAsWebUser(page: Page): Promise<void> {
  const { email, password } = webCredentials()
  const auth = new AuthPage(page)
  await auth.gotoLogin()
  const res = await auth.login(email, password)
  expect(res.ok(), `Web 登录失败 status=${res.status()} body 可能需检查 CAPTCHA/账号`).toBeTruthy()
  await expect(page).toHaveURL(/\/chats/, { timeout: 30_000 })
}
