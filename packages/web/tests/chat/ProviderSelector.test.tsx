import type { ProviderListItem } from '@goferbot/data'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProviderSelector } from '@/features/chat/components/ProviderSelector'

const providers: ProviderListItem[] = [
  { key: 'openai#gpt-4o-mini', name: 'OpenAI', model: 'gpt-4o-mini', isBuiltin: true },
  { key: 'openai#gpt-4o', name: 'OpenAI', model: 'gpt-4o', isBuiltin: true },
]

describe('ProviderSelector', () => {
  it('opens list and selects model (mousedown safe)', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <ProviderSelector
        providers={providers}
        selectedKey={null}
        onChange={onChange}
        variant="chip"
      />,
    )

    await user.click(screen.getByTestId('provider-selector-trigger'))
    expect(await screen.findByTestId('provider-selector-dropdown')).toBeTruthy()

    const items = screen.getAllByTestId('provider-selector-item')
    expect(items).toHaveLength(2)
    await user.click(items[1])

    expect(onChange).toHaveBeenCalledWith('openai#gpt-4o')
  })

  it('shows empty state with retry when no providers', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    render(
      <ProviderSelector providers={[]} selectedKey={null} onChange={vi.fn()} onRetry={onRetry} />,
    )

    // 空列表时触发器仍可点（不再因 length===0 永久 disabled）
    const trigger = screen.getByTestId('provider-selector-trigger') as HTMLButtonElement
    expect(trigger.disabled).toBe(false)
    await user.click(trigger)
    await user.click(await screen.findByTestId('provider-selector-retry'))
    expect(onRetry).toHaveBeenCalled()
  })

  it('displays selected model name on trigger', () => {
    render(
      <ProviderSelector
        providers={providers}
        selectedKey="openai#gpt-4o-mini"
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId('provider-selector-trigger').textContent).toContain('gpt-4o-mini')
  })
})
