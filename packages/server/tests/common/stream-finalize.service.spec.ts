import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StreamFinalizeService } from '@/common/services/stream-finalize.service.js'

describe('StreamFinalizeService', () => {
  let service: StreamFinalizeService

  beforeEach(() => {
    service = new StreamFinalizeService()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs all steps via microtask queue', async () => {
    const order: string[] = []
    service.schedule({ span: 't1' }, [
      { name: 'a', run: async () => order.push('a') },
      { name: 'b', run: async () => order.push('b') },
    ])

    await vi.runAllTimersAsync()

    expect(order).toEqual(['a', 'b'])
  })

  it('does not rethrow when a step fails', async () => {
    const order: string[] = []
    const failing = {
      name: 'fail',
      run: async () => {
        order.push('fail')
        throw new Error('boom')
      },
    }
    const success = { name: 'ok', run: async () => order.push('ok') }

    expect(() => service.schedule({ span: 't2' }, [failing, success])).not.toThrow()

    await vi.runAllTimersAsync()

    expect(order).toEqual(['fail', 'ok'])
  })

  it('continues to next step when one step fails', async () => {
    const order: string[] = []
    service.schedule({ span: 't3' }, [
      { name: 'fail-a', run: async () => { order.push('a'); throw new Error('x') } },
      { name: 'fail-b', run: async () => { order.push('b'); throw new Error('y') } },
      { name: 'ok', run: async () => order.push('c') },
    ])

    await vi.runAllTimersAsync()

    expect(order).toEqual(['a', 'b', 'c'])
  })
})
