import { chromium, Browser, Page } from '@playwright/test'
import { spawn, ChildProcess } from 'child_process'

function waitForPort(host: string, port: number, timeout = 60000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      const net = require('net')
      const socket = new net.Socket()
      socket.setTimeout(1000)
      socket.once('connect', () => { socket.destroy(); resolve() })
      socket.once('error', () => {
        socket.destroy()
        if (Date.now() - start > timeout) reject(new Error('Timeout waiting for CDP port'))
        else setTimeout(check, 500)
      })
      socket.once('timeout', () => { socket.destroy(); setTimeout(check, 500) })
      socket.connect(port, host)
    }
    check()
  })
}

export async function launchTauriApp(): Promise<{ app: ChildProcess; browser: Browser; page: Page }> {
  const appPath = 'src-tauri/target/release/knowledge-base.exe'
  const app = spawn(appPath, [], {
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9222',
    },
  })

  await waitForPort('127.0.0.1', 9222)

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
  const context = browser.contexts()[0]
  const page = context.pages()[0] || await context.newPage()

  return { app, browser, page }
}

export async function closeTauriApp(app: ChildProcess, browser: Browser) {
  await browser.close()
  app.kill()
  await new Promise((resolve) => app.once('exit', resolve))
}
