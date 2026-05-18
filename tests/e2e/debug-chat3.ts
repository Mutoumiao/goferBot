import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript(() => {
    localStorage.setItem('goferbot_access_token', 'mock-access-token-12345');
    localStorage.setItem('goferbot_refresh_token', 'mock-refresh-token-67890');
  });

  await page.route('**/auth/me', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { data: { id: 'user-1', email: 'test@example.com', name: 'Test User' } } });
    } else route.continue();
  });

  await page.route('**/api/settings', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { providers: { deepseek: { apiKey: 'key', model: 'deepseek-chat', baseUrl: '' } }, temperature: 0.7, defaultChatProvider: 'deepseek' } });
    } else route.continue();
  });

  await page.route('**/knowledge-bases', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { data: [] } });
    } else route.continue();
  });

  await page.route('**/sessions/**', (route) => {
    route.fulfill({ json: { items: [] } });
  });

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('ERR:', msg.text().slice(0, 300));
  });
  page.on('pageerror', err => console.log('PAGE_ERR:', err.message));

  await page.goto('http://localhost:1420/app/chat', { timeout: 15000, waitUntil: 'load' });
  await page.waitForTimeout(3000);

  console.log('URL:', page.url());
  
  // Search for specific testids
  const hasChatInput = await page.locator('[data-testid="chat-input"]').count();
  const hasTabBar = await page.locator('[data-testid="tab-bar"]').count();
  const hasEmptySession = await page.locator('[data-testid="empty-session-input"]').count();
  
  console.log('chat-input count:', hasChatInput);
  console.log('tab-bar count:', hasTabBar);
  console.log('empty-session-input count:', hasEmptySession);
  
  // Check main content
  const mainHtml = await page.locator('main').innerHTML();
  console.log('main innerHTML (first 1000):', mainHtml.slice(0, 1000));
  
  await browser.close();
})();
