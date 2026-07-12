import type { MessageInstance } from 'antd/es/message/interface'
import type { ModalStaticFunctions } from 'antd/es/modal/confirm'
import type { NotificationInstance } from 'antd/es/notification/interface'

export type AppModal = Omit<ModalStaticFunctions, 'warn'>

/**
 * 命令式场景（非 React 组件 / Promise 弹窗）无法调用 App.useApp()。
 * 由 ConfigProvider 内的桥接组件在挂载后注入，供 utils 复用主题上下文。
 */
const apis: {
  message: MessageInstance | null
  modal: AppModal | null
  notification: NotificationInstance | null
} = {
  message: null,
  modal: null,
  notification: null,
}

export function bindAntdAppApis(next: {
  message: MessageInstance
  modal: AppModal
  notification: NotificationInstance
}): void {
  apis.message = next.message
  apis.modal = next.modal
  apis.notification = next.notification
}

export function getAppMessage(): MessageInstance {
  if (!apis.message) {
    throw new Error('Antd App message 未初始化：请确认 ConfigProvider 已挂载 <App>')
  }
  return apis.message
}

export function getAppModal(): AppModal {
  if (!apis.modal) {
    throw new Error('Antd App modal 未初始化：请确认 ConfigProvider 已挂载 <App>')
  }
  return apis.modal
}

export function getAppNotification(): NotificationInstance {
  if (!apis.notification) {
    throw new Error('Antd App notification 未初始化：请确认 ConfigProvider 已挂载 <App>')
  }
  return apis.notification
}
