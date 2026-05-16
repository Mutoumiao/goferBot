import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApiClient } from '../client'
import { ApiError, NetworkError } from '../errors'

describe('createApiClient', () => {
  const baseURL = 'http://localhost:3000'
  let api = createApiClient({ baseURL })

  beforeEach(() => {
    api = createApiClient({ baseURL })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('get 返回解析后的 JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ id: '1' }),
    } as Response)

    const result = await api.get<{ id: string }>('/test')
    expect(result).toEqual({ id: '1' })
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/test',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    )
  })

  it('post 发送 JSON body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ created: true }),
    } as Response)

    const result = await api.post<{ created: boolean }>('/test', { name: 'foo' })
    expect(result).toEqual({ created: true })
    const init = (fetch as any).mock.calls[0][1]
    expect(init.body).toBe('{"name":"foo"}')
  })

  it('HTTP 4xx 抛出 ApiError', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: 'Invalid input' }),
    } as Response)

    await expect(api.get('/test')).rejects.toBeInstanceOf(ApiError)
    await expect(api.get('/test')).rejects.toMatchObject({
      status: 400,
      code: 'HTTP_400',
      message: 'Invalid input',
    })
  })

  it('fetch 失败抛出 NetworkError', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'))

    await expect(api.get('/test')).rejects.toBeInstanceOf(NetworkError)
    await expect(api.get('/test')).rejects.toMatchObject({
      message: 'Network failure',
    })
  })

  it('超时抛出 NetworkError', async () => {
    global.fetch = vi.fn().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined
          if (signal) {
            signal.addEventListener('abort', () => {
              reject(new Error('Request timeout'))
            })
          }
        })
    )

    await expect(api.get('/test', { timeout: 1 })).rejects.toBeInstanceOf(NetworkError)
  })

  it('401 触发 onUnauthorized 钩子并仍抛出 ApiError', async () => {
    const unauthorizedHandler = vi.fn()
    api.onUnauthorized = unauthorizedHandler

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: 'Unauthorized' }),
    } as Response)

    await expect(api.get('/test')).rejects.toBeInstanceOf(ApiError)
    expect(unauthorizedHandler).toHaveBeenCalledTimes(1)
  })

  it('请求拦截器可修改 headers', async () => {
    api.addRequestInterceptor((config) => {
      config.headers = { ...config.headers, 'X-Custom': 'foo' }
      return config
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({}),
    } as Response)

    await api.get('/test')
    const init = (fetch as any).mock.calls[0][1]
    expect(init.headers).toMatchObject({ 'X-Custom': 'foo' })
  })

  it('响应拦截器可修改 response', async () => {
    api.addResponseInterceptor(async (res) => {
      return { ...res, ok: true, json: async () => ({ fixed: true }) }
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: 'fail' }),
    } as Response)

    // 拦截器将 ok 改为 true 并替换 json，因此不抛异常并返回新数据
    await expect(api.get('/test')).resolves.toEqual({ fixed: true })
  })

  it('delete 返回 void', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
      json: async () => ({}),
    } as Response)

    const result = await api.delete('/test')
    expect(result).toBeUndefined()
  })

  it('sse 解析 data 行并调用 onChunk', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"chunk":"hello"}\n\n'))
        controller.enqueue(encoder.encode('data: {"chunk":" world"}\n\n'))
        controller.close()
      },
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    } as unknown as Response)

    const chunks: unknown[] = []
    await new Promise<void>((resolve) => {
      api.sse(
        '/chat',
        { message: 'hi' },
        {
          onChunk: (c) => chunks.push(c),
          onError: (e) => { throw e },
          onDone: () => resolve(),
        }
      )
    })

    expect(chunks).toEqual([{ chunk: 'hello' }, { chunk: ' world' }])
  })
})
