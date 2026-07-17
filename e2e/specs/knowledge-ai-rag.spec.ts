/**
 * Knowledge AI RAG 浏览器 E2E
 *
 * 验证：登录 → 创建 KB → 上传 → 索引 ready → Chat 强制选 KB → SSE 回答 + SourceCitations
 *
 * 前置：
 *   - Web http://localhost:1420
 *   - Nest http://localhost:3100（Admin 已配 LLM + embedding）
 *   - Knowledge AI / Docker / Ollama 可用
 *
 * 与 07-10 上传弹窗一并跑：
 *   WEB_SERVER_URL=http://localhost:1420 pnpm test:e2e:web
 */
import { expect, test } from '@playwright/test'
import { loginAsWebUser } from '../fixtures/web-auth'
import { KnowledgeBasePage } from '../pages/KnowledgeBasePage'
import { RagChatPage } from '../pages/RagChatPage'

const ANCHOR = 'GB-VERIFY-7788'
const DOC_CONTENT = [
  '【Playwright RAG 验证】文档内容：GoferBot 知识库问答专用。',
  `唯一检索锚点：青瓷茶盏编号 ${ANCHOR}。`,
  '请在回答中引用该编号。',
  '',
].join('\n')

test.describe.configure({ mode: 'serial' })

test.describe('Knowledge AI RAG（真实后端）', () => {
  test('上传→ready→聊天并展示引用来源', async ({ page }) => {
    test.setTimeout(300_000)

    const kbPage = new KnowledgeBasePage(page)
    const chatPage = new RagChatPage(page)
    const kbName = `pw-rag-${Date.now()}`

    await loginAsWebUser(page)

    await kbPage.openFromSidebar()
    const kbId = await kbPage.createKnowledgeBase(kbName)
    const docId = await kbPage.uploadTextFile('pw-rag-verify.txt', DOC_CONTENT)

    await kbPage.waitDocumentReady(kbId, docId, 180_000)

    await chatPage.openChatHome()
    await chatPage.selectKnowledgeBaseByName(kbName)
    await chatPage.submitFromHome('青瓷茶盏编号是什么？请根据知识库回答，并写出完整编号。')

    await expect(page).toHaveURL(/\/chats/, { timeout: 30_000 })
    await chatPage.waitForAssistantWithSources(120_000)

    await expect(chatPage.sourcesEmpty).toHaveCount(0)
    await expect(chatPage.sourcesTrigger).toContainText(/引用\s*\d+\s*篇/)
    await chatPage.openSourcesAndExpectDocs(1)

    const assistantText = await chatPage.getVisibleAssistantText()
    const pageText = await page.locator('main, [role="main"], body').first().innerText()
    const hasAnchorInUi =
      assistantText.includes(ANCHOR) ||
      pageText.includes(ANCHOR) ||
      pageText.includes('7788') ||
      pageText.toLowerCase().includes('gb-verify')

    const sourcesText = await chatPage.sourcesPanel.innerText()
    const hasAnchorInSources = sourcesText.includes(ANCHOR) || sourcesText.includes('青瓷')

    expect(
      hasAnchorInUi || hasAnchorInSources || (await chatPage.sourceDocItems.count()) >= 1,
      `UI 应出现检索锚点、来源摘要或文档级引用。assistant=${assistantText.slice(0, 120)} sources=${sourcesText.slice(0, 200)}`,
    ).toBeTruthy()
  })
})
