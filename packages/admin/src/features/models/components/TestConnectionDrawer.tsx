import { Modal } from 'antd'
import type { ModelConfig } from '../services'
import { testModelConnection } from '../services'

export async function TestConnectionDrawer(model: ModelConfig): Promise<void> {
  const r = await testModelConnection(model.id)
  if (!r.success) {
    Modal.error({
      title: '连接失败',
      content: r.message ?? '未知错误',
    })
  }
}
