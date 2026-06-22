import '@testing-library/jest-dom/vitest'

// mocks
if (typeof window !== 'undefined') {
  // matchMedia
  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })
  }

  // IntersectionObserver
  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
      root = null
      rootMargin = ''
      thresholds = []
    } as any
  }

  // ResizeObserver
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    } as any
  }

  // scrollTo
  window.scrollTo = () => {}
}

// localStorage helpers
const STORAGE_KEYS = [
  'goferbot_admin_access_token',
  'goferbot_admin_refresh_token',
  'goferbot_admin-auth',
  'goferbot-admin-settings',
  'goferbot_admin_remember_email',
]

beforeEach(() => {
  STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
})
