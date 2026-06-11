import { AbstractChatProvider } from '@ant-design/x-sdk'
import type { TransformMessage, XRequestOptions, SSEOutput } from '@ant-design/x-sdk'

import type { StreamChatRequest } from '@goferbot/data'

export type GoferInput = StreamChatRequest

export interface GoferOutput {
  chunk: string
  done: boolean
  error?: string
}

export interface GoferMessage {
  content: string
  role: 'user' | 'assistant'
}

export class GoferChatProvider extends AbstractChatProvider<GoferMessage, GoferInput, SSEOutput> {
  transformParams(
    requestParams: Partial<GoferInput>,
    _options: XRequestOptions<GoferInput, SSEOutput, GoferMessage>,
  ): GoferInput {
    return {
      input: requestParams.input || '',
      sessionId: requestParams.sessionId || '',
      knowledgeBaseIds: requestParams.knowledgeBaseIds ?? [],
      lastMessageId: requestParams.lastMessageId,
    }
  }

  transformLocalMessage(requestParams: Partial<GoferInput>): GoferMessage {
    return {
      content: requestParams.input || '',
      role: 'user',
    }
  }

  transformMessage(info: TransformMessage<GoferMessage, SSEOutput>): GoferMessage {
    const { originMessage, chunk } = info
    const data = chunk?.data as GoferOutput | undefined

    if (data?.error) {
      return {
        content: data.error,
        role: 'assistant',
      }
    }

    if (data?.done) {
      return {
        content: originMessage?.content || '',
        role: 'assistant',
      }
    }

    return {
      content: `${originMessage?.content || ''}${data?.chunk || ''}`,
      role: 'assistant',
    }
  }
}
