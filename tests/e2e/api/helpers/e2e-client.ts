/**
 * E2E HTTP 客户端封装
 * 使用 axios 与真实 NestJS 进程通信
 */
import axios, { AxiosInstance, AxiosResponse } from 'axios'

const API_BASE = process.env.E2E_API_BASE || 'http://127.0.0.1:3000/api'

function randomIp(): string {
  return `192.168.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`
}

export class E2EClient {
  private axios: AxiosInstance
  private token: string | null = null

  constructor() {
    this.axios = axios.create({
      baseURL: API_BASE,
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true, // 不抛出 HTTP 错误，由测试断言
    })
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'X-Forwarded-For': randomIp() }
    if (this.token) {
      h['Authorization'] = `Bearer ${this.token}`
    }
    return h
  }

  setToken(token: string) {
    this.token = token
    this.axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }

  clearToken() {
    this.token = null
    delete this.axios.defaults.headers.common['Authorization']
  }

  async getPublicKey(): Promise<AxiosResponse> {
    return this.axios.get('/auth/public-key', { headers: this.headers() })
  }

  async register(email: string, encryptedPassword: string, name: string): Promise<AxiosResponse> {
    return this.axios.post('/auth/register', { email, encryptedPassword, name }, { headers: this.headers() })
  }

  async login(email: string, encryptedPassword: string): Promise<AxiosResponse> {
    return this.axios.post('/auth/login', { email, encryptedPassword }, { headers: this.headers() })
  }

  async refresh(refreshToken: string): Promise<AxiosResponse> {
    return this.axios.post('/auth/refresh', { refreshToken }, { headers: this.headers() })
  }

  async logout(): Promise<AxiosResponse> {
    return this.axios.post('/auth/logout', {}, { headers: this.headers() })
  }

  async me(): Promise<AxiosResponse> {
    return this.axios.get('/auth/me', { headers: this.headers() })
  }

  async createKB(name: string, description?: string): Promise<AxiosResponse> {
    return this.axios.post('/knowledge-bases', { name, description }, { headers: this.headers() })
  }

  async listKBs(): Promise<AxiosResponse> {
    return this.axios.get('/knowledge-bases', { headers: this.headers() })
  }

  async updateKB(id: string, data: any): Promise<AxiosResponse> {
    return this.axios.patch(`/knowledge-bases/${id}`, data, { headers: this.headers() })
  }

  async deleteKB(id: string): Promise<AxiosResponse> {
    return this.axios.delete(`/knowledge-bases/${id}`, { headers: this.headers() })
  }

  async uploadDocument(kbId: string, file: Buffer, filename: string, mimeType: string): Promise<AxiosResponse> {
    // form-data 是 CommonJS 模块，动态导入需要运行时判断 default
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formDataModule: any = await import('form-data')
    const FormDataCtor = formDataModule.default || formDataModule
    const formData = new FormDataCtor()
    formData.append('file', file, { filename, contentType: mimeType })

    const h = this.headers()
    return this.axios.post(`/knowledge-bases/${kbId}/documents/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        'X-Forwarded-For': h['X-Forwarded-For'] || randomIp(),
        ...(h['Authorization'] ? { 'Authorization': h['Authorization'] } : {}),
      },
    })
  }

  async createSession(title: string): Promise<AxiosResponse> {
    return this.axios.post('/sessions', { title }, { headers: this.headers() })
  }

  async chat(dto: { message: string; sessionId: string; knowledgeBaseIds?: string[]; config?: any }): Promise<AxiosResponse> {
    return this.axios.post('/chat', dto, {
      headers: {
        'Accept': 'text/event-stream',
        ...this.headers(),
      },
      responseType: 'stream',
    })
  }

  getAxiosInstance(): AxiosInstance {
    return this.axios
  }
}
