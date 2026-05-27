import { test, expect } from '@playwright/test'
import { existsSync } from 'fs'

test.describe('E2E Infrastructure (q-16)', () => {
  test('AC-01: Tauri e2e-full directory is removed', () => {
    expect(existsSync('tests/e2e-full')).toBe(false)
  })
})
