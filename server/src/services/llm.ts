import type { LLMConfig } from '../types.js'

function getDefaultBaseUrl(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com'
    case 'deepseek':
      return 'https://api.deepseek.com'
    default:
      return ''
  }
}

export async function streamChatCompletion(
  messages: Array<{ role: string; content: string }>,
  config: LLMConfig,
  onChunk: (content: string) => void | Promise<void>,
  systemPrompt?: string
): Promise<void> {
  const url = config.baseUrl || getDefaultBaseUrl(config.provider)
  if (!url) {
    throw new Error(`Unknown provider: ${config.provider}`)
  }

  const apiMessages: Array<{ role: string; content: string }> = []
  if (systemPrompt) {
    apiMessages.push({ role: 'system', content: systemPrompt })
  }
  apiMessages.push(...messages)

  const response = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: apiMessages,
      stream: true,
    }),
  })

  if (!response.ok) {
    const error = await response.text().catch(() => 'Unknown error')
    throw new Error(`LLM API error: ${response.status} ${error}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim() || !line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content
        if (content) {
          await onChunk(content)
        }
      } catch {
        // ignore parse errors
      }
    }
  }
}
