import { AbstractChatProvider } from '@ant-design/x-sdk'
import type { TransformMessage, XRequestOptions, SSEOutput } from '@ant-design/x-sdk'
import type { ChatMessagesChunk, ChatMessagesRequest } from '@goferbot/data'

export type GoferInput = ChatMessagesRequest

export type GoferOutput = ChatMessagesChunk

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
      response_mode: 'streaming',
      query: requestParams.query || '',
      conversation_id: requestParams.conversation_id || '',
      provider_key: requestParams.provider_key,
      parent_message_id: requestParams.parent_message_id,
      inputs: requestParams.inputs,
      files: requestParams.files,
      knowledge_base_ids: requestParams.knowledge_base_ids,
    }
  }

  transformLocalMessage(requestParams: Partial<GoferInput>): GoferMessage {
    return {
      content: requestParams.query || '',
      role: 'user',
    }
  }

  transformMessage(info: TransformMessage<GoferMessage, SSEOutput>): GoferMessage {
    const { originMessage, chunk } = info
    let data: GoferOutput | undefined
    try {
      if (typeof chunk?.data === 'string') {
        data = JSON.parse(chunk.data) as GoferOutput
      }
    } catch {
      data = undefined
    }

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
      content: `${originMessage?.content || ''}${data?.answer || ''}`,
      role: 'assistant',
    }
  }
}
