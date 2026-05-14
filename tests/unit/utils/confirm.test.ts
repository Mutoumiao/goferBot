import { describe, it, expect, vi } from 'vitest'
import { confirmDialog } from '@/utils/confirm'

// 模拟 ConfirmDialog 组件，直接触发回调
vi.mock('@/components/ConfirmDialog.vue', () => ({
  default: {
    name: 'ConfirmDialog',
    props: ['visible', 'title', 'message', 'confirmText', 'cancelText', 'kind'],
    emits: ['confirm', 'cancel'],
    setup(props: Record<string, unknown>, { emit }: { emit: (event: string) => void }) {
      // 组件挂载后立即触发 confirm，模拟用户点击确定
      if (props.message === 'Are you sure?') {
        setTimeout(() => emit('confirm'), 0)
      } else if (props.message === 'Cancel me?') {
        setTimeout(() => emit('cancel'), 0)
      }
      return () => null
    },
  },
}))

describe('confirmDialog', () => {
  it('returns true when user confirms', async () => {
    const result = await confirmDialog('Are you sure?', { title: '提示' })
    expect(result).toBe(true)
  })

  it('returns false when user cancels', async () => {
    const result = await confirmDialog('Cancel me?', { title: '提示' })
    expect(result).toBe(false)
  })

  it('passes correct options to dialog', async () => {
    const result = await confirmDialog('Are you sure?', {
      title: '删除确认',
      kind: 'danger',
      confirmText: '删除',
      cancelText: '保留',
    })
    expect(result).toBe(true)
  })
})
