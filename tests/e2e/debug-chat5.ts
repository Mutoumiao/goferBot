import { chromium } from '@playwright/test';
import { mockApiRoutes } from './mocks/http-routes';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // EXACT replica of chat.spec.ts beforeEach
  await page.addInitScript(() => {
    localStorage.setItem('goferbot_access_token', 'mock-access-token-12345');
    localStorage.setItem('goferbot_refresh_token', 'mock-refresh-token-67890');
  });

  await mockApiRoutes(page);

  // Override auth/me just like the test does
  await page.route('**/auth/me', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { id: 'user-1', email: 'test@example.com', name: 'Test User' } });
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('ERR:', msg.text().slice(0, 300));
  });
  page.on('pageerror', err => console.log('PAGE_ERR:', err.message));

  let requests: string[] = [];
  page.on('request', req => requests.push(req.url().replace('http://localhost:1420', '')));
  page.on('requestfailed', req => console.log('REQ_FAILED:', req.url(), req.failure()?.errorText));

  console.log('Navigating to /app/chat...');
  await page.goto('http://localhost:1420/app/chat', { timeout: 15000, waitUntil: 'load' });
  await page.waitForTimeout(3000);

  console.log('URL:', page.url());
  const hasChatInput = await page.locator('[data-testid="chat-input"]').count();
  const hasTabBar = await page.locator('[data-testid="tab-bar"]').count();
  console.log('chat-input:', hasChatInput, 'tab-bar:', hasTabBar);
  console.log('Requests:', requests.filter(r => r.startsWith('/api')));
  
  await browser.close();
})();
