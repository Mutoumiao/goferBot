import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'

export async function confirmDialog(message: string): Promise<boolean> {
  try {
    return await tauriConfirm(message)
  } catch {
    // 如果 Tauri dialog 不可用，回退到原生 confirm
    return window.confirm(message)
  }
}
