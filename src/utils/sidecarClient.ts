let currentPort: number | null = null

export function setSidecarPort(port: number): void {
  currentPort = port
}

export function getSidecarPort(): number | null {
  return currentPort
}

export function clearSidecarPort(): void {
  currentPort = null
}

export async function sidecarFetch(
  path: string,
  options: RequestInit = {},
  retries = 3
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    const port = currentPort
    if (!port) {
      throw new Error('Sidecar port not available')
    }
    const url = `http://127.0.0.1:${port}${path}`
    try {
      const response = await fetch(url, options)
      if (response.ok || i === retries) {
        return response
      }
    } catch (err) {
      if (i === retries) throw err
      await new Promise((r) => setTimeout(r, 300 * (i + 1)))
    }
  }

  const finalPort = currentPort
  if (!finalPort) {
    throw new Error('Sidecar port not available')
  }
  return fetch(`http://127.0.0.1:${finalPort}${path}`, options)
}

export async function healthCheck(): Promise<boolean> {
  if (!currentPort) return false
  try {
    const res = await fetch(`http://127.0.0.1:${currentPort}/health`, {
      signal: AbortSignal.timeout(2000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function isSidecarReady(): Promise<boolean> {
  return healthCheck()
}
