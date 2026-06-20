/**
 * Chat 模块公共类型出口。
 *
 * ChatState 已在 store.ts 中定义，此处直接重导出以避免两处维护同名类型。
 */
export type { ChatState } from './store'

// 若后续新增 chat 模块共享类型，请直接在此文件中补充。
