/**
 * Knowledge Chat AI SDK Transport（API Mock）
 *
 * 覆盖 A2/A4：选 KB → 建会话 → SSE sources+message → 引用摘要 + 助手正文。
 * 不依赖真实 Knowledge AI。
 *
 *   pnpm exec playwright test --config e2e/playwright.config.ts e2e/specs/chat-ai-sdk-transport.spec.ts
 */
import { expect, test } from '@playwright/test'
import {
  createInitialAuthState,
  installAuthMocks,
  installChatMocks,
} from '../fixtures/mocks'
import { AuthPage } from '../pages/AuthPage'
import { RagChatPage } from '../pages/RagChatPage'

test.describe.configure({ mode: 'serial' })

test.describe('Chat AI SDK Transport（API Mock）', () => {
  test('选 KB → 提问 → 流式正文 + 引用摘要', async ({ page }) => {
    test.setTimeout(90_000)

    const state = createInitialAuthState()
    state.users.set('mock-chat@example.com', {
      id: 'user-mock-1',
      name: 'Mock User',
      email: 'mock-chat@example.com',
      password: 'Password123',
    })
    await installAuthMocks(page, state)
    installChatMocks(page)

    const auth = new AuthPage(page)
    const chat = new RagChatPage(page)

    await auth.gotoLogin()
    const loginRes = await auth.login('mock-chat@example.com', 'Password123')
    expect(loginRes.ok(), `mock 登录失败 ${loginRes.status()}`).toBeTruthy()
    await expect(page).toHaveURL(/\/chats/, { timeout: 30_000 })

    await expect(page.getByTestId('chat-empty-home')).toBeVisible({ timeout: 20_000 })
    await chat.selectKnowledgeBaseByName('Mock 知识库')
    await chat.submitFromHome('青瓷茶盏编号是什么？')

    await expect(page.getByTestId('chat-session-view')).toBeVisible({ timeout: 20_000 })
    await chat.waitForAssistantWithSources(30_000)
    await expect(chat.sourcesEmpty).toHaveCount(0)
    await chat.openSourcesAndExpectDocs(1)

    const text = await chat.getVisibleAssistantText()
    expect(
      text.includes('Mock AI') || text.includes('收到'),
      `助手正文应含 mock 回答，实际: ${text.slice(0, 200)}`,
    ).toBeTruthy()
  })
})
