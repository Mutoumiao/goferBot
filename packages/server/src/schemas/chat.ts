import { z } from 'zod'

export const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().uuid(),
  knowledgeBaseIds: z.array(z.string().uuid()).optional(),
  config: z.object({
    provider: z.enum(['openai', 'claude', 'deepseek', 'custom', 'ollama']),
    model: z.string().min(1),
    temperature: z.number().min(0).max(2).default(0.7),
  }).strict(),
}).strict()

export type ChatRequest = z.infer<typeof chatSchema>
