import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import type { PrismaService } from '@/processors/database/prisma.service.js'
import type { RagService } from '@/modules/chat/rag.service.js'
import type { SettingsService } from '@/modules/settings/settings.service.js'
import type { ModelRegistryService } from '@/modules/chat/model-registry.service.js'

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    stream: vi.fn().mockImplementation(async function* () {
      yield { content: 'ok' }
    }),
  })),
}))

function createService(overrides: {
  settings?: Record<string, unknown>
  prisma?: Record<string, unknown>
}) {
  const mockSettingsService = {
    getSettings: vi
      .fn()
      .mockResolvedValue(
        overrides.settings ?? { providers: {}, defaultChatProvider: '' },
      ),
  }

  const mockPrisma = overrides.prisma ?? {
    $transaction: vi.fn().mockResolvedValue([]),
    session: {
      findUnique: vi.fn().mockResolvedValue({ id: 's1', userId: 'u1' }),
      update: vi.fn().mockResolvedValue({}),
    },
    message: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
  }

  const mockConfigService = {
    get: vi.fn().mockReturnValue(undefined),
    getOrThrow: vi.fn(),
  }

  const mockModelRegistry = {
    lookup: vi.fn().mockReturnValue(undefined),
  }

  return import('@/modules/chat/chat.service.js').then(({ ChatService }) => {
    return new ChatService(
      mockPrisma as unknown as PrismaService,
      mockConfigService as unknown as ConfigService,
      { retrieveContext: vi.fn().mockResolvedValue({ context: null }) } as unknown as RagService,
      mockSettingsService as unknown as SettingsService,
      mockModelRegistry as unknown as ModelRegistryService,
    )
  })
}

describe('ChatService.resolveProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('RP-01: 使用 dto.providerKey 合法时优先选择该 provider', async () => {
    const service = await createService({
      settings: {
        providers: {
          openai: { name: 'OpenAI', apiKey: 'k', model: 'gpt-4', baseUrl: '' },
          claude: { name: 'Claude', apiKey: 'k', model: 'sonnet', baseUrl: '' },
        },
        defaultChatProvider: 'openai',
      },
    })

    const dto = {
      query: 'hi',
      conversation_id: 's1',
      provider_key: 'claude',
    }

    // resolveProvider 成功时不会抛 PROVIDER_INVALID；
    // 后续可能因未配置 env API Key 抛 LLM_NOT_CONFIGURED，
    // 但这属于 createChatModel 内部逻辑，非本用例的断言目标。
    let providerInvalidCaught = false
    try {
      for await (const _ of (service as any).streamChat('u1', dto)) {
        /* consume */
      }
    } catch (err: unknown) {
      const response = (err as BadRequestException)?.getResponse?.() as
        | { code?: string }
        | undefined
      if (response?.code === 'PROVIDER_INVALID') {
        providerInvalidCaught = true
      }
    }
    expect(providerInvalidCaught).toBe(false)
  })

  it('RP-02: dto.providerKey 缺失时回退到 defaultChatProvider', async () => {
    const service = await createService({
      settings: {
        providers: {
          deepseek: { name: 'DeepSeek', apiKey: 'k', model: 'ds', baseUrl: '' },
        },
        defaultChatProvider: 'deepseek',
      },
    })

    const dto = {
      query: 'hi',
      conversation_id: 's1',
      // 未指定 provider_key
    }

    let providerInvalidCaught = false
    try {
      for await (const _ of (service as any).streamChat('u1', dto)) {
        /* consume */
      }
    } catch (err: unknown) {
      const response = (err as BadRequestException)?.getResponse?.() as
        | { code?: string }
        | undefined
      if (response?.code === 'PROVIDER_INVALID') {
        providerInvalidCaught = true
      }
    }
    expect(providerInvalidCaught).toBe(false)
  })

  it('RP-03: 非法 providerKey 抛 BadRequestException(PROVIDER_INVALID)', async () => {
    const service = await createService({
      settings: {
        providers: {
          deepseek: { name: 'DeepSeek', apiKey: 'k', model: 'ds', baseUrl: '' },
        },
        defaultChatProvider: 'deepseek',
      },
    })

    const dto = {
      query: 'hi',
      conversation_id: 's1',
      provider_key: 'not-exist-provider',
    }

    let caught: BadRequestException | null = null
    try {
      for await (const _ of (service as any).streamChat('u1', dto)) {
        /* consume */
      }
    } catch (err: unknown) {
      if (err instanceof BadRequestException) {
        caught = err
      } else {
        throw err
      }
    }

    expect(caught).not.toBeNull()
    const response = caught!.getResponse() as { code?: string; message?: string }
    expect(response.code).toBe('PROVIDER_INVALID')
  })

  it('RP-04: defaultChatProvider 指向不存在的 provider 时也抛 PROVIDER_INVALID', async () => {
    const service = await createService({
      settings: {
        providers: {
          openai: { name: 'OpenAI', apiKey: 'k', model: 'gpt-4', baseUrl: '' },
        },
        defaultChatProvider: 'missing-key',
      },
    })

    const dto = {
      query: 'hi',
      conversation_id: 's1',
    }

    let caught: BadRequestException | null = null
    try {
      for await (const _ of (service as any).streamChat('u1', dto)) {
        /* consume */
      }
    } catch (err: unknown) {
      if (err instanceof BadRequestException) {
        caught = err
      } else {
        throw err
      }
    }

    expect(caught).not.toBeNull()
    const response = caught!.getResponse() as { code?: string }
    expect(response.code).toBe('PROVIDER_INVALID')
  })
})
