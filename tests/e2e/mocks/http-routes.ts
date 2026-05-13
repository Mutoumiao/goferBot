import type { Page } from '@playwright/test'

export interface RouteHandler {
  pattern: string | RegExp
  handler: (route: any) => Promise<void> | void
}

export const defaultKbList = [
  { id: 'kb-1', name: 'Default KB', description: '', createdAt: Date.now() },
]

export const defaultSessionList = [
  { id: 'sess-1', title: 'Hello', updatedAt: Date.now() },
]

export function createMockRoutes(overrides: RouteHandler[] = []) {
  const handlers = new Map<string | RegExp, RouteHandler['handler']>()

  // Default handlers
  handlers.set('**/knowledge-bases', (route: any) =>
    route.fulfill({ json: defaultKbList }),
  )
  handlers.set('**/sessions', (route: any) =>
    route.fulfill({ json: defaultSessionList }),
  )
  handlers.set('**/settings', (route: any) =>
    route.fulfill({ json: {} }),
  )
  handlers.set('**/health', (route: any) =>
    route.fulfill({ json: { status: 'ok' } }),
  )

  for (const o of overrides) {
    handlers.set(o.pattern, o.handler)
  }

  return handlers
}

export async function mockHttpRoutes(page: Page, overrides: RouteHandler[] = []) {
  const handlers = createMockRoutes(overrides)
  await page.route('http://127.0.0.1:**', (route) => {
    const url = route.request().url()
    for (const [pattern, handler] of handlers) {
      if (typeof pattern === 'string') {
        if (url.includes(pattern.replace('**', ''))) {
          return handler(route)
        }
      } else if (pattern.test(url)) {
        return handler(route)
      }
    }
    route.continue()
  })
}
