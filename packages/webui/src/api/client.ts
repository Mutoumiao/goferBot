const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const url = `${API_BASE}${path}`
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  }
  if (body !== undefined) {
    options.body = JSON.stringify(body)
  }
  return fetch(url, options)
}

export function apiSubscribe(
  path: string,
  body: Record<string, unknown>,
  onMessage: (data: string, eventType: string) => void,
): { completed: Promise<void> } {
  const url = `${API_BASE}${path}`

  const completed = new Promise<void>((resolve, reject) => {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok || !res.body) {
          reject(new Error(`SSE request failed: ${res.status}`))
          return
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') {
                  resolve()
                  return
                }
                onMessage(data, 'message')
              }
              if (line.startsWith('event: ')) {
                const eventType = line.slice(7)
                if (eventType === 'error') {
                  onMessage('', 'error')
                }
              }
            }
          }
          resolve()
        } catch (e) {
          reject(e)
        }
      })
      .catch(reject)
  })

  return { completed }
}
