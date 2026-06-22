import { Modal, message } from 'antd'
import { testConnection } from '@/api/model'
import type { ModelConfig } from '@/api/model'

export async function TestConnectionDrawer(model: ModelConfig): Promise<void> {
  const r = await testConnection(model.id)
  if (r.success) {
    message.success(`连接成功，耗时 ${r.latencyMs ?? 0}ms`)
  } else {
    Modal.error({
      title: '连接失败',
      content: r.message ?? '未知错误',
    })
  }
}
