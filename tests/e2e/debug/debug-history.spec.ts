import { test } from '@playwright/test'
import { mockApiRoutes } from '../mocks/http-routes'
import { injectMockToken } from '../fixtures/auth'

test('调试历史页面', async ({ page }) => {
  await injectMockToken(page)
  
  // 记录所有请求
  page.on('request', (request) => {
    console.log(`Request: ${request.method()} ${request.url()}`)
  })
  
  page.on('response', (response) => {
    console.log(`Response: ${response.status()} ${response.url()}`)
  })
  
  // 收集错误
  const errors: string[] = []
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })
  
  await mockApiRoutes(page)
  await page.goto('/app/history')
  await page.waitForLoadState('networkidle')
  
  // 等待页面渲染
  await page.waitForTimeout(3000)
  
  // 输出页面内容
  const html = await page.content()
  console.log('Page HTML:', html.substring(0, 2000))
  
  // 检查是否有 session-item 元素
  const items = await page.locator('[data-testid="session-item"]').all()
  console.log('Session items found:', items.length)
  
  // 检查错误
  if (errors.length > 0) {
    console.log('Errors:', errors)
  }
})