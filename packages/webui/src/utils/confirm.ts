import { h, render } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

interface ConfirmOptions {
  title?: string
  confirmText?: string
  cancelText?: string
  kind?: 'info' | 'warning' | 'danger'
}

export function confirmDialog(
  message: string,
  options: ConfirmOptions = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const vnode = h(ConfirmDialog, {
      visible: true,
      title: options.title || '提示',
      message,
      confirmText: options.confirmText,
      cancelText: options.cancelText,
      kind: options.kind || 'info',
      onConfirm: () => {
        cleanup()
        resolve(true)
      },
      onCancel: () => {
        cleanup()
        resolve(false)
      },
    })

    render(vnode, container)

    function cleanup() {
      render(null, container)
      document.body.removeChild(container)
    }
  })
}
