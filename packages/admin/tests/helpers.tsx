import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { ConfigProvider } from 'antd'

export function renderWithProviders(ui: ReactElement) {
  return render(<ConfigProvider>{ui}</ConfigProvider>)
}

export function waitForLoading(delayMs = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}
