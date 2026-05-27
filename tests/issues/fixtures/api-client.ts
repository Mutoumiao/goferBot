const API_BASE = 'http://localhost:3000/api'

export class ApiClient {
  private token: string

  constructor(token: string) {
    this.token = token
  }

  private async fetch(path: string, opts: RequestInit = {}): Promise<any> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...opts.headers,
      },
    })
    if (!res.ok) {
      throw new Error(`API ${path} failed: ${res.status} ${await res.text()}`)
    }
    const data = await res.json()
    return data.data ?? data
  }

  async createKB(name: string, description?: string) {
    return this.fetch('/knowledge-bases', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    })
  }

  async listKBs() {
    return this.fetch('/knowledge-bases')
  }

  async deleteKB(id: string) {
    return this.fetch(`/knowledge-bases/${id}`, { method: 'DELETE' })
  }

  async createSession(title?: string) {
    return this.fetch('/sessions', {
      method: 'POST',
      body: JSON.stringify(title ? { title } : {}),
    })
  }

  async listSessions() {
    return this.fetch('/sessions')
  }

  async getSettings() {
    return this.fetch('/settings')
  }

  async saveSettings(settings: any) {
    return this.fetch('/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    })
  }

  async uploadDocument(kbId: string, file: { name: string; content: string; type: string }) {
    const formData = new FormData()
    const blob = new Blob([file.content], { type: file.type })
    formData.append('file', blob, file.name)

    const res = await fetch(`${API_BASE}/knowledge-bases/${kbId}/documents/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}` },
      body: formData,
    })
    if (!res.ok) {
      throw new Error(`Upload failed: ${res.status} ${await res.text()}`)
    }
    const data = await res.json()
    return data.data ?? data
  }
}
