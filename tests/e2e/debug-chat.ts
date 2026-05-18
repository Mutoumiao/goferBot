import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Inject auth token
  await page.addInitScript(() => {
    localStorage.setItem('goferbot_access_token', 'mock-access-token-12345');
    localStorage.setItem('goferbot_refresh_token', 'mock-refresh-token-67890');
  });

  // Mock auth/me
  await page.route('**/auth/me', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { data: { id: 'user-1', email: 'test@example.com', name: 'Test User' } } });
    }
  });

  // Mock settings
  await page.route('**/api/settings', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { providers: {}, temperature: 0.7, defaultChatProvider: 'deepseek' } });
    }
  });

  // Mock knowledge-bases
  await page.route('**/knowledge-bases', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { data: [] } });
    }
  });

  // Mock sessions
  await page.route('**/sessions', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { items: [] } });
    }
  });

  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE_ERROR:', err.message));

  try {
    await page.goto('http://localhost:1420/app/chat', { timeout: 10000, waitUntil: 'load' });
    console.log('URL after goto:', page.url());
    
    const html = await page.content();
    console.log('HTML length:', html.length);
    console.log('Has chat-input:', html.includes('data-testid="chat-input"'));
    console.log('Has tab-bar:', html.includes('data-testid="tab-bar"'));
    console.log('Body text (first 500):', (await page.locator('body').innerText()).slice(0, 500));
  } catch (e) {
    console.log('ERROR:', e);
  }

  await browser.close();
})();
