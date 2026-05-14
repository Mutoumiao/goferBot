import { ref } from 'vue'
import { getShell } from '@/shell'

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

export async function initSidecarStatus(): Promise<void> {
  if (initDone) return
  initDone = true

  sidecarStatus.value = 'loading'
  sidecarError.value = ''

  const shell = getShell()

  try {
    const p = await shell.getSidecarPort()
    if (p !== null) {
      sidecarPort.value = p
      sidecarStatus.value = 'ready'
      return
    }
  } catch {
    // sidecar not ready yet, wait for events
  }

  let settleWait: (() => void) | null = null
  const waitPromise = new Promise<void>((resolve) => {
    settleWait = resolve
  })
  const callSettleWait = () => settleWait?.()

  try {
    if (!readyUnlisten) {
      readyUnlisten = await shell.onSidecarReady((event) => {
        sidecarPort.value = event.port
        sidecarStatus.value = 'ready'
        clearTimeoutIfAny()
        callSettleWait()
        settleWait = null
      })
    }

    if (!restartedUnlisten) {
      restartedUnlisten = await shell.onSidecarRestarted((event) => {
        sidecarPort.value = event.port
        sidecarStatus.value = 'ready'
        clearTimeoutIfAny()
        callSettleWait()
        settleWait = null
      })
    }
  } catch (e) {
    console.error('[sidecar] Failed to listen for events:', e)
    sidecarStatus.value = 'error'
    sidecarError.value = '无法监听服务状态，请检查权限配置'
    callSettleWait()
    settleWait = null
    return
  }

  timeoutId = setTimeout(() => {
    if (sidecarStatus.value !== 'ready') {
      sidecarStatus.value = 'error'
      sidecarError.value = '服务启动超时，请检查日志或重启应用'
    }
    callSettleWait()
    settleWait = null
  }, 30000)

  await waitPromise
}

export async function retrySidecarStatus(): Promise<void> {
  clearTimeoutIfAny()
  sidecarStatus.value = 'loading'
  sidecarError.value = ''

  const shell = getShell()
  try {
    await shell.restartSidecar()
  } catch (e) {
    sidecarStatus.value = 'error'
    sidecarError.value = String(e)
  }
}

export function _resetSidecarStatusForTest(): void {
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
