import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { ref } from 'vue'
import { setSidecarPort } from '@/utils/sidecarClient'

export type SidecarStatus = 'loading' | 'ready' | 'error'

export const sidecarStatus = ref<SidecarStatus>('loading')
export const sidecarPort = ref<number | null>(null)
export const sidecarError = ref<string>('')

let initDone = false
let timeoutId: ReturnType<typeof setTimeout> | null = null
let readyUnlisten: (() => void) | null = null
let restartedUnlisten: (() => void) | null = null

function clearTimeoutIfAny(): void {
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
}

export async function initSidecar(): Promise<void> {
  if (initDone) return
  initDone = true

  sidecarStatus.value = 'loading'
  sidecarError.value = ''

  try {
    const p = await invoke<number>('get_sidecar_port')
    setSidecarPort(p)
    sidecarPort.value = p
    sidecarStatus.value = 'ready'
    return
  } catch {
    // sidecar not ready yet, wait for events
  }

  let settleWait: (() => void) | null = null
  const waitPromise = new Promise<void>((resolve) => {
    settleWait = resolve
  })

  try {
    if (!readyUnlisten) {
      readyUnlisten = await listen<{ port: number }>('sidecar-ready', (event) => {
        setSidecarPort(event.payload.port)
        sidecarPort.value = event.payload.port
        sidecarStatus.value = 'ready'
        clearTimeoutIfAny()
        settleWait?.()
        settleWait = null
      })
    }

    if (!restartedUnlisten) {
      restartedUnlisten = await listen<{ port: number }>('sidecar-restarted', (event) => {
        setSidecarPort(event.payload.port)
        sidecarPort.value = event.payload.port
        sidecarStatus.value = 'ready'
        clearTimeoutIfAny()
        settleWait?.()
        settleWait = null
      })
    }
  } catch (e) {
    console.error('[sidecar] Failed to listen for events:', e)
    sidecarStatus.value = 'error'
    sidecarError.value = '无法监听服务状态，请检查权限配置'
    settleWait?.()
    settleWait = null
    return
  }

  timeoutId = setTimeout(() => {
    if (sidecarStatus.value !== 'ready') {
      sidecarStatus.value = 'error'
      sidecarError.value = '服务启动超时，请检查日志或重启应用'
    }
    settleWait?.()
    settleWait = null
  }, 30000)

  await waitPromise
}

export async function retrySidecar(): Promise<void> {
  clearTimeoutIfAny()
  sidecarStatus.value = 'loading'
  sidecarError.value = ''

  try {
    await invoke('restart_sidecar')
  } catch (e) {
    sidecarStatus.value = 'error'
    sidecarError.value = String(e)
  }
}

export function _resetSidecarStateForTest(): void {
  initDone = false
  sidecarStatus.value = 'loading'
  sidecarPort.value = null
  sidecarError.value = ''
  clearTimeoutIfAny()
  readyUnlisten?.()
  restartedUnlisten?.()
  readyUnlisten = null
  restartedUnlisten = null
}
