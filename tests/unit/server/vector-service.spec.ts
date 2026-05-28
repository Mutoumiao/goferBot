import { describe, it, expect } from 'vitest'
import { VectorService } from '../../../packages/server/src/processors/vector/vector.service.js'

describe('VectorService', () => {
  it('AC-01: implements SDK IVectorStore interface', () => {
    // 类型编译测试：VectorService 必须能被赋值给 SDK IVectorStore
    const svc: import('@goferbot/rag-sdk').IVectorStore = {} as VectorService
    expect(svc).toBeDefined()
  })

  it('AC-02: deleteByFileId and deleteByKbId remain as extension methods', () => {
    const proto = VectorService.prototype as any
    expect(typeof proto.deleteByFileId).toBe('function')
    expect(typeof proto.deleteByKbId).toBe('function')
    // 扩展方法不在 SDK IVectorStore 接口中，但 TypeScript 允许
  })
})
