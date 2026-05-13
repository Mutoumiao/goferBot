import { test, expect } from '@playwright/test'
import { existsSync } from 'fs'
import { launchTauriApp, closeTauriApp } from '../setup'
import type { ChildProcess } from 'child_process'
import type { Browser, Page } from '@playwright/test'

const appPath = 'src-tauri/target/release/knowledge-base.exe'
const hasBuild = existsSync(appPath)

test.describe.configure({ mode: 'serial' })

test.describe('Smoke Acceptance Tests', () => {
  test.skip(!hasBuild, `Tauri build not found at ${appPath} — skipping full e2e smoke tests`)

  let app: ChildProcess
  let browser: Browser
  let page: Page

  test.beforeAll(async () => {
    const launched = await launchTauriApp()
    app = launched.app
    browser = launched.browser
    page = launched.page
  })

  test.afterAll(async () => {
    if (app && browser) {
      await closeTauriApp(app, browser)
    }
  })

  test('journey: create KB -> import file -> verify indexing', async () => {
    // Navigate to Knowledge Base page via sidebar
    await page.locator('button:has(.i-mdi-database-outline)').click()
    await expect(page.locator('[data-testid="kb-list"]')).toBeVisible()

    // Create a new knowledge base
    await page.locator('[data-testid="create-kb-btn"]').click()
    await page.locator('[data-testid="kb-name-input"]').fill('Smoke KB')
    await page.locator('[data-testid="kb-create-confirm"]').click()

    // Verify KB appears in list
    const kbItem = page.locator('[data-testid="kb-item"]').filter({ hasText: 'Smoke KB' })
    await expect(kbItem).toBeVisible()

    // Select the KB and wait for file explorer
    await kbItem.click()
    await expect(page.locator('[data-testid="file-explorer"]')).toBeVisible()

    // Get sidecar port so we can seed a file via the REST API
    const sidecarPort = await page.evaluate(async () => {
      return await (window as any).__TAURI_INTERNALS__.invoke('get_sidecar_port')
    })

    // Find the KB ID via sidecar API
    const kbListRes = await page.evaluate(async (port: number) => {
      const res = await fetch(`http://127.0.0.1:${port}/knowledge-bases`)
      return res.json()
    }, sidecarPort)
    const kb = (kbListRes as any[]).find((k) => k.name === 'Smoke KB')
    expect(kb).toBeTruthy()

    // Import a test file via sidecar API
    await page.evaluate(async ({ port, kbId }: { port: number; kbId: string }) => {
      await fetch(`http://127.0.0.1:${port}/knowledge-bases/${kbId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [{ name: 'smoke.md', content: '# Smoke Test\nThis is a test document for RAG.' }],
        }),
      })
    }, { port: sidecarPort, kbId: kb.id })

    // Refresh the file explorer by re-selecting the KB
    await page.locator('[data-testid="kb-item"]').first().click()
    await kbItem.click()

    // Verify the imported file appears
    await expect(
      page.locator('[data-testid="file-explorer"]').getByText('smoke.md')
    ).toBeVisible()
  })

  test('journey: @mention -> send -> verify LLM response contains retrieval', async () => {
    // Navigate to Chat via sidebar
    await page.locator('button:has(.i-mdi-message-text-outline)').click()

    // Ensure we are in a chat session (create one if needed)
    const chatInput = page.locator('[data-testid="chat-input"]')
    const isChatVisible = await chatInput.isVisible().catch(() => false)
    if (!isChatVisible) {
      await page.locator('[data-testid="new-chat-btn"]').click()
      await expect(chatInput).toBeVisible()
    }

    // Mock the chat endpoint to return a deterministic response
    await page.route('http://127.0.0.1:*/chat', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
          body: 'data: {"content":"RAG works"}\n\ndata: [DONE]\n\n',
        })
      } else {
        route.continue()
      }
    })

    // Trigger @ mention
    const textarea = page.locator('[data-testid="chat-input"] textarea')
    await textarea.click()
    await textarea.evaluate((el: HTMLElement) => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: '@', bubbles: true }))
    })

    // Select the first knowledge base from the dropdown
    await expect(page.locator('[data-testid="kb-mention-dropdown"]')).toBeVisible()
    await page.locator('[data-testid="kb-mention-item"]').first().click()

    // Verify mention pill is rendered
    await expect(page.locator('[data-testid="kb-mention-pill"]')).toBeVisible()

    // Type question and send
    await textarea.fill('Does RAG work?')
    await page.locator('[data-testid="chat-send-btn"]').click()

    // Verify the assistant response contains "RAG works"
    await expect(
      page.locator('[data-testid="chat-message"]').filter({ hasText: 'RAG works' })
    ).toBeVisible()
  })

  test('journey: settings save -> new session uses default model', async () => {
    // Navigate to Settings via sidebar
    await page.locator('button:has(.i-mdi-cog-outline)').click()
    await expect(page.locator('[data-testid="settings-form"]')).toBeVisible()

    // Switch to Claude tab and set a distinctive model name
    await page.locator('[data-testid="settings-nav-tabs"]').locator('text=Claude').click()
    await page.locator('[data-testid="settings-form"] input[name="model"]').fill('claude-smoke-model')

    // Change default provider to Claude
    const defaultProviderSelect = page.locator('[data-testid="settings-form"] select').first()
    await defaultProviderSelect.selectOption('claude')

    // Save settings
    await page.locator('[data-testid="settings-save-btn"]').click()
    await expect(page.locator('[data-testid="settings-save-btn"]')).toBeDisabled()

    // Close any existing chat tabs to force a fresh session on next new-chat
    while (true) {
      const closeBtn = page.locator('span.i-mdi-close').first()
      const visible = await closeBtn.isVisible().catch(() => false)
      if (!visible) break
      await closeBtn.click()
      await page.waitForTimeout(150)
    }

    // Navigate to Chat and create a new session
    await page.locator('button:has(.i-mdi-message-text-outline)').click()
    await page.locator('[data-testid="new-chat-btn"]').click()

    // Verify the model selector reflects the saved default
    await expect(page.getByText('Claude · claude-smoke-model')).toBeVisible()
  })
})
