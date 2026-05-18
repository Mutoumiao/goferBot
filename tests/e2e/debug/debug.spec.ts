import { test, expect } from '@playwright/test'
import { mockApiRoutes } from '../mocks/http-routes'
import { injectAuthToken } from '../fixtures/auth'

test('调试设置页面 - 检查页面结构', async ({ page }) => {
  await injectAuthToken(page)
  await mockApiRoutes(page)

  // 收集所有错误
  const errors: string[] = []
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  page.on('requestfailed', (request) => {
    errors.push(`Request failed: ${request.url()} - ${request.failure()?.errorText}`)
  })

  await page.goto('/settings')
  await page.waitForLoadState('load')

  // 等待一段时间让页面渲染
  await page.waitForTimeout(8000)

  // 检查页面标题
  const title = await page.title()
  console.log('页面标题:', title)

  // 检查当前URL
  const url = page.url()
  console.log('当前URL:', url)

  // 检查是否有错误
  if (errors.length > 0) {
    console.log('=== 页面错误 ===')
    errors.forEach((err, index) => {
      console.log(`${index + 1}. ${err}`)
    })
    console.log('=== 错误结束 ===')
  } else {
    console.log('没有页面错误')
  }

  // 获取页面上的所有元素文本
  const allText = await page.evaluate(() => {
    return document.body.innerText.substring(0, 2000)
  })
  console.log('=== 页面文本内容 ===')
  console.log(allText)
  console.log('=== 文本内容结束 ===')

  // 获取页面内容
  const content = await page.content()
  console.log('=== 页面HTML内容（前4000字符）===')
  console.log(content.substring(0, 4000))
  console.log('=== HTML内容结束 ===')
})
