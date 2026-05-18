import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // EXACTLY what the chat.spec.ts test does
  await page.addInitScript(() => {
    localStorage.setItem('goferbot_access_token', 'mock-access-token-12345');
    localStorage.setItem('goferbot_refresh_token', 'mock-refresh-token-67890');
  });

  // This is mockApiRoutes from http-routes.ts
  await page.route('**/auth/me', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { data: { id: 'user-1', email: 'test@example.com', name: 'Test User' } } });
    }
  });
  await page.route('**/api/settings', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { providers: { deepseek: { apiKey: 'key', model: 'deepseek-chat', baseUrl: '' } }, temperature: 0.7, defaultChatProvider: 'deepseek' } });
    }
  });
  await page.route('**/knowledge-bases', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { data: [] } });
    }
  });
  await page.route('**/sessions', (route) => {
    route.fulfill({ json: { items: [] } });
  });

  // Override auth/me just like the chat.spec.ts test does - WITHOUT data wrapper!
  await page.route('**/auth/me', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { id: 'user-1', email: 'test@example.com', name: 'Test User' } });
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('ERR:', msg.text().slice(0, 300));
  });
  page.on('pageerror', err => console.log('PAGE_ERR:', err.message));

  await page.goto('http://localhost:1420/app/chat', { timeout: 15000, waitUntil: 'load' });
  await page.waitForTimeout(2000);

  console.log('URL:', page.url());
  const hasChatInput = await page.locator('[data-testid="chat-input"]').count();
  const hasTabBar = await page.locator('[data-testid="tab-bar"]').count();
  console.log('chat-input:', hasChatInput, 'tab-bar:', hasTabBar);
  
  await browser.close();
})();
