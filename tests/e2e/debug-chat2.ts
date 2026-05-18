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

  await page.route('**/sessions', (route) => {
    route.fulfill({ json: { items: [] } });
  });

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log('CONSOLE[' + msg.type() + ']:', msg.text().slice(0, 200));
    }
  });
  page.on('pageerror', err => console.log('PAGE_ERROR:', err.message));

  await page.goto('http://localhost:1420/app/chat', { timeout: 15000, waitUntil: 'load' });
  await page.waitForTimeout(3000);

  console.log('URL:', page.url());
  
  // Check root element
  const appHtml = await page.locator('#app').innerHTML();
  console.log('#app innerHTML length:', appHtml.length);
  console.log('#app innerHTML (first 2000):', appHtml.slice(0, 2000));
  
  await browser.close();
})();
