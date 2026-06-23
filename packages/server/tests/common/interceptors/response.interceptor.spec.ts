/**
 * ResponseInterceptor 单元测试
 * 验证统一响应包装，以及对 BigInt 字段的序列化兜底处理。
 *
 * 背景：Prisma 的 Document.size 为 BigInt?，直接返回会导致
 * JSON.stringify 抛出 "Do not know how to serialize a BigInt"。
 * 拦截器需在包装前将所有 bigint 递归转为 number。
 */

import type { CallHandler, ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { lastValueFrom, of } from 'rxjs'
import { describe, expect, it, vi } from 'vitest'
import { ResponseInterceptor } from '../../../src/common/interceptors/response.interceptor.js'

function createInterceptor(bypass = false): ResponseInterceptor<unknown> {
  const reflector = { get: vi.fn().mockReturnValue(bypass) } as unknown as Reflector
  return new ResponseInterceptor(reflector)
}

const mockContext = {
  getHandler: () => () => undefined,
} as unknown as ExecutionContext

function handlerOf(value: unknown): CallHandler {
  return { handle: () => of(value) } as CallHandler
}

describe('ResponseInterceptor BigInt 序列化兜底', () => {
  it('将顶层 bigint 字段转换为 string 以保留精度', async () => {
    const interceptor = createInterceptor()
    const result = await lastValueFrom(
      interceptor.intercept(mockContext, handlerOf({ id: 'doc-1', size: BigInt(2048) })),
    )

    // 转换后应可被 JSON 序列化，且 size 为 string（保留精度）
    expect(() => JSON.stringify(result)).not.toThrow()
    expect((result.data as { size: unknown }).size).toBe('2048')
    expect(typeof (result.data as { size: unknown }).size).toBe('string')
  })

  it('递归转换嵌套对象与数组中的 bigint', async () => {
    const interceptor = createInterceptor()
    const payload = {
      items: [{ size: BigInt(5) }, { size: BigInt(10) }],
      nested: { total: BigInt(100) },
    }
    const result = await lastValueFrom(interceptor.intercept(mockContext, handlerOf(payload)))

    expect(() => JSON.stringify(result)).not.toThrow()
    const data = result.data as {
      items: { size: number }[]
      nested: { total: number }
    }
    expect(data.items[0].size).toBe('5')
    expect(data.items[1].size).toBe('10')
    expect(data.nested.total).toBe('100')
  })

  it('不影响非 bigint 字段', async () => {
    const interceptor = createInterceptor()
    const result = await lastValueFrom(
      interceptor.intercept(
        mockContext,
        handlerOf({ name: 'a.pdf', count: 3, flag: true, empty: null }),
      ),
    )
    expect(result.data).toEqual({ name: 'a.pdf', count: 3, flag: true, empty: null })
  })
})
