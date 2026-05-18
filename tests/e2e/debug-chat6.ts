import { chromium } from '@playwright/test';

// Import and manually test each route section
async function addRouteByRoute(page: any) {
  // Route 1: health
  await page.route('**/health', (route) => {
    route.fulfill({ json: { status: 'ok' } });
  });
  console.log('  health route set up');

  // Route 2: auth/me
  await page.route('**/auth/me', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { data: { id: 'user-1', email: 'test@example.com', name: 'Test User' } } });
    }
  });
  console.log('  auth/me route set up');

  // Route 3: auth/refresh
  await page.route('**/auth/refresh', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({ json: { data: { accessToken: 't', refreshToken: 't' } } });
    }
  });
  console.log('  auth/refresh route set up');

  // Route 4: chat
  await page.route('**/chat', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: 'data: {"content":"OK"}\n\n' });
    }
  });
  console.log('  chat route set up');

  // Route 5-6: sessions
  await page.route('**/sessions', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { items: [] } });
    } else if (route.request().method() === 'POST') {
      route.fulfill({ json: { id: 's1', title: 'x', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messageCount: 0 } });
    }
  });
  console.log('  sessions route set up');

  await page.route('**/sessions/*', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { data: { id: 's1', title: 'x', messages: [] } } });
    } else if (route.request().method() === 'DELETE') {
      route.fulfill({ json: { data: { success: true } } });
    } else if (route.request().method() === 'PATCH') {
      route.fulfill({ json: { data: { success: true } } });
    }
  });
  console.log('  sessions/* route set up');

  // Route 7-8: knowledge-bases
  await page.route('**/knowledge-bases', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { data: [] } });
    } else if (route.request().method() === 'POST') {
      route.fulfill({ json: { data: { id: 'kb1', name: 'x', is_pinned: 0, sort_order: 0, created_at: Date.now() } } });
    }
  });
  console.log('  knowledge-bases route set up');

  await page.route('**/knowledge-bases/*', (route) => {
    if (route.request().method() === 'DELETE') {
      route.fulfill({ json: { data: { success: true } } });
    } else if (route.request().method() === 'PATCH') {
      route.fulfill({ json: { data: { success: true } } });
    }
  });
  console.log('  knowledge-bases/* route set up');

  // Route 9: documents
  await page.route('**/knowledge-bases/*/documents', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { data: [] } });
    }
  });
  console.log('  documents route set up');

  // Route 10: api/settings (my fix)
  await page.route('**/api/settings', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { providers: {}, temperature: 0.7, defaultChatProvider: 'deepseek' } });
    } else if (route.request().method() === 'POST') {
      route.fulfill({ json: { data: { success: true } } });
    }
  });
  console.log('  api/settings route set up');
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript(() => {
    localStorage.setItem('goferbot_access_token', 'mock-access-token-12345');
    localStorage.setItem('goferbot_refresh_token', 'mock-refresh-token-67890');
  });

  // Add routes one at a time  
  console.log('Setting up routes...');
  await addRouteByRoute(page);

  // Override auth/me (test-specific)
  await page.route('**/auth/me', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { id: 'user-1', email: 'test@example.com', name: 'Test User' } });
    }
  });

  page.on('requestfailed', req => {
    console.log('REQ_FAILED:', req.url().replace(/http:\/\/localhost:\d+/, ''), req.failure()?.errorText);
  });

  console.log('Navigating...');
  try {
    await page.goto('http://localhost:1420/app/chat', { timeout: 15000, waitUntil: 'load' });
    console.log('SUCCESS! URL:', page.url());
  } catch(e) {
    console.log('TIMEOUT! URL at failure:', page.url());
    // Check what requests are pending
    const pendingCount = await page.locator('body').count();
    console.log('Body found:', pendingCount > 0);
  }
  
  await page.waitForTimeout(1000);
  const hasChatInput = await page.locator('[data-testid="chat-input"]').count();
  console.log('chat-input count:', hasChatInput);
  
  await browser.close();
})();
