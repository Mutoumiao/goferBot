import { Hono } from 'hono'
import fs from 'node:fs'
import path from 'node:path'
import { getAppDataDir } from '../utils.js'
import type { AppConfig } from '../types.js'

const app = new Hono()

export const DEFAULT_CONFIG: AppConfig = {
  providers: {
    openai: { apiKey: '', model: 'gpt-4o', baseUrl: '' },
    claude: { apiKey: '', model: 'claude-3-5-sonnet-20241022', baseUrl: '' },
    deepseek: { apiKey: '', model: 'deepseek-chat', baseUrl: '' },
    custom: { apiKey: '', model: '', baseUrl: '' },
    ollama: { enabled: false, url: 'http://localhost:11434', model: '' },
  },
  embeddingProvider: { provider: 'openai', apiKey: '', model: 'text-embedding-3-small', baseUrl: '' },
  temperature: 0.7,
  defaultChatProvider: 'deepseek',
}

function getConfigPath(): string {
  return path.join(getAppDataDir(), 'config.json')
}

function loadConfig(): AppConfig {
  const configPath = getConfigPath()
  if (!fs.existsSync(configPath)) {
    return DEFAULT_CONFIG
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    return { ...DEFAULT_CONFIG, ...parsed, providers: { ...DEFAULT_CONFIG.providers, ...parsed.providers } }
  } catch {
    return DEFAULT_CONFIG
  }
}

function saveConfig(config: AppConfig): void {
  const configPath = getConfigPath()
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

app.get('/', (c) => {
  return c.json(loadConfig())
})

app.post('/', async (c) => {
  const body = await c.req.json<AppConfig>()
  saveConfig(body)
  return c.json({ success: true })
})

export default app
