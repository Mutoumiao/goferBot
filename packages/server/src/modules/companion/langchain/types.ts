import type { ChatPromptTemplate } from '@langchain/core/prompts'
import type { Runnable } from '@langchain/core/runnables'
import type { ChatOpenAI } from '@langchain/openai'
import type { z } from 'zod'

export type WireApi = 'chat_completions' | 'responses'

export type StructuredOutputMethod = 'jsonSchema' | 'functionCalling' | 'jsonMode'

export type { ChatOpenAI }

export interface StreamChunk {
  text: string
  done: boolean
}

export interface StructuredOutputOptions<T> {
  schema: z.ZodSchema<T>
  name: string
  method?: StructuredOutputMethod
}

export type PromptInput = string | ChatPromptTemplate | Runnable
